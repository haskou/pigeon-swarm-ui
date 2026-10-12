import { UUID } from '@haskou/value-objects';
import { Buffer } from 'buffer';

import type {
  ChatMessage,
  ConversationResource,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { MailboxKeys } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type {
  MailboxReadTokens,
  OpenedMailboxPage,
} from '../../../mailboxes/infrastructure/MailboxChannel';
import type { MessageProjectionPort } from '../crypto/MessageProjectionPort';
import type { DirectMessageRecord } from './DirectMessageMailboxRecord';
import type { DirectMessageMailboxState } from './DirectMessageMailboxStore';
import type { DirectMessageReaderSet } from './DirectMessageReaderSet';

import { ConversationKeychain } from '../../../identities/infrastructure/keychain/ConversationKeychain';
import { MailboxEnvelopeCipher } from '../../../mailboxes/infrastructure/crypto/MailboxEnvelopeCipher';
import { MailboxKeySchedule } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import { MailboxReadToken } from '../../../mailboxes/infrastructure/crypto/MailboxReadToken';
import { MailboxUnavailableError } from '../../../mailboxes/infrastructure/http/MailboxUnavailableError';
import { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';
import { DirectMessageMailboxRecord } from './DirectMessageMailboxRecord';
import { DirectMessageMailboxStore } from './DirectMessageMailboxStore';

export type DirectMessageMailboxDelivery = 'delivered' | 'failed' | 'skipped';

/** One change to the timeline, in the order the inbox holds it. */
export type DirectMessageTimelineChange =
  | { kind: 'edit'; message: ChatMessage }
  | { kind: 'message'; message: ChatMessage }
  | {
      action: 'add' | 'remove';
      authorId: string;
      createdAt: number;
      emoji: string;
      kind: 'reaction';
      messageId: string;
    }
  | { kind: 'removed'; messageId: string };

/** Keys, reader tokens, and saved state for the inbox this device reads. */
type RecipientInbox = {
  keys: MailboxKeys;
  readers: MailboxReadTokens;
  state: DirectMessageMailboxState;
};

/**
 * Direct one-to-one messages over the opaque mailbox: sent, edited, deleted,
 * and reactions. The legacy send delivers first; this path carries a copy so
 * the peer can receive it without the replicated path. Duplicates collapse by
 * message id in the timeline.
 */
export class DirectMessageMailbox {
  private static readonly PAGE_SIZE = 50;
  private static readonly EPOCH = 0;

  private readonly opening = new Map<string, Promise<RecipientInbox>>();

  public constructor(
    private readonly channel: MailboxChannel,
    private readonly store: DirectMessageMailboxStore,
    private readonly projection: Pick<MessageProjectionPort, 'decryptMany'>,
    private readonly readerSet: DirectMessageReaderSet,
  ) {}

  /**
   * Sender. Appends a sent message to the peer's inbox. Returns 'skipped' when
   * there is no peer, the conversation is a group, or the record exceeds the
   * envelope bound; the message then stays on the legacy path only. Never
   * throws: any failure, including 404 for an inbox the peer has not opened
   * yet, returns 'failed'. The caller keeps the legacy copy and shows nothing
   * to the user.
   */
  public deliverSent(
    session: Session,
    conversation: ConversationResource,
    sent: MessageResource,
  ): Promise<DirectMessageMailboxDelivery> {
    return this.append(session, conversation, () =>
      DirectMessageMailboxRecord.fromSent(conversation.id, sent),
    );
  }

  /** Sender. Edit of a sent message. Same outcomes as deliverSent. */
  public deliverEdit(
    session: Session,
    conversation: ConversationResource,
    edited: MessageResource,
  ): Promise<DirectMessageMailboxDelivery> {
    return this.append(session, conversation, () =>
      DirectMessageMailboxRecord.fromEdited(conversation.id, edited),
    );
  }

  /** Sender. Delete of a message by id. Same outcomes as deliverSent. */
  public deliverDelete(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
  ): Promise<DirectMessageMailboxDelivery> {
    return this.append(session, conversation, () => ({
      authorId: session.identity.id,
      conversationId: conversation.id,
      createdAt: Date.now(),
      id: UUID.generate().toString(),
      targetMessageId: messageId,
      type: 'deleted',
    }));
  }

  /** Sender. Appends a reaction add or remove. Same outcomes as deliverSent. */
  public deliverReaction(
    session: Session,
    conversation: ConversationResource,
    reaction: {
      action: 'add' | 'remove';
      createdAt: number;
      emoji: string;
      messageId: string;
    },
  ): Promise<DirectMessageMailboxDelivery> {
    return this.append(session, conversation, () => ({
      action: reaction.action,
      authorId: session.identity.id,
      conversationId: conversation.id,
      createdAt: reaction.createdAt,
      emoji: reaction.emoji,
      id: UUID.generate().toString(),
      targetMessageId: reaction.messageId,
      type: 'reaction',
    }));
  }

  /**
   * Recipient. Reads the next page of this identity's inbox, applies its
   * changes, then acknowledges. The cursor advances only after the
   * acknowledgement succeeds, so an interrupted pass is replayed and the
   * timeline dedupes by id. A pass superseded before its inbox is created or
   * read leaves the inbox untouched. The first pass on a device creates the
   * inbox. When the inbox was re-created, its cursors restart at 1, so the
   * stored cursor is reset.
   *
   * Reader tokens are derived from the identity's root key, so a device that
   * lost its local storage reads the inbox it created earlier. Only inboxes
   * created before this derivation keep a stored legacy token, which the
   * first pass adopts into the reader set.
   */
  public async sync(
    session: Session,
    conversationId: string,
    signal: AbortSignal,
    apply: (changes: DirectMessageTimelineChange[]) => void,
  ): Promise<void> {
    if (signal.aborted) return;

    const inbox = await this.openInboxShared(session, conversationId);

    if (signal.aborted) return;

    await this.readerSet.reconcile(session, inbox.keys, inbox.readers);

    if (signal.aborted) return;

    const { cursor, page } = await this.readPage(inbox);

    if (page.lastCursor <= cursor || signal.aborted) return;

    await this.applyPage(session, conversationId, inbox, page, signal, apply);
  }

  /**
   * Shared sender path. Skips without sending when there is no peer, the
   * conversation is a group, or the encoded record exceeds the envelope bound.
   * Building the record runs inside the try, so a throw there is 'failed'.
   */
  private async append(
    session: Session,
    conversation: ConversationResource,
    build: () => DirectMessageRecord,
  ): Promise<DirectMessageMailboxDelivery> {
    const recipientIdentityId = conversation.participantIds.find(
      (identityId) => identityId !== session.identity.id,
    );

    if (
      !recipientIdentityId ||
      !DirectMessageMailboxRecord.isEligible(conversation.type)
    ) {
      return 'skipped';
    }

    try {
      const plaintext = DirectMessageMailboxRecord.encode(build());

      if (plaintext.byteLength > MailboxEnvelopeCipher.MAX_PLAINTEXT_BYTES) {
        return 'skipped';
      }

      const keys = this.keysFor(session, conversation.id, recipientIdentityId);

      await this.channel.send(keys, plaintext);

      return 'delivered';
    } catch {
      // Count-only: no ids, content, or error details.
      // eslint-disable-next-line no-console
      console.debug('Direct mailbox append failed; legacy copy kept.');

      return 'failed';
    }
  }

  /**
   * Resolves the inbox keys, reader tokens, and saved state. A stored legacy
   * token first frees readers no device holds, then is adopted into the
   * reader set. The derived tokens are never persisted.
   */
  private async openInbox(
    session: Session,
    conversationId: string,
  ): Promise<RecipientInbox> {
    const keys = this.keysFor(session, conversationId, session.identity.id);
    const readers = this.readersFor(session, keys);
    const stored = this.store.load(keys.mailboxId);

    if (stored && !stored.readToken) {
      return { keys, readers, state: stored };
    }

    if (stored?.readToken) {
      // Before adoption: a full inbox refuses the device readers.
      await this.readerSet.pruneUnderLegacy(
        session,
        keys,
        readers,
        stored.readToken,
      );

      if (await this.adoptLegacy(keys, stored.readToken, readers)) {
        const adopted = { cursor: stored.cursor };

        this.store.save(keys.mailboxId, adopted);

        return { keys, readers, state: adopted };
      }
    }

    const state = { cursor: 0 };

    // Saved before the create: a pass that starts after this open settles
    // reads the stored state, while overlapping passes await this open.
    this.store.save(keys.mailboxId, state);
    await this.ensureInbox(keys, readers);

    return { keys, readers, state };
  }

  /**
   * Overlapping passes share one open. A pass that starts while the inbox is
   * still being created awaits that create, so it never reads a missing inbox.
   */
  private openInboxShared(
    session: Session,
    conversationId: string,
  ): Promise<RecipientInbox> {
    const key = `${session.identity.id}:${conversationId}`;
    const inFlight = this.opening.get(key);

    if (inFlight) return inFlight;

    const opening = this.openInbox(session, conversationId).finally(() => {
      this.opening.delete(key);
    });

    this.opening.set(key, opening);

    return opening;
  }

  /**
   * Registers both readers under the legacy token, which carries root
   * authority for an inbox created before derivation. Returns false when that
   * inbox no longer exists; other failures keep the stored state and surface.
   */
  private async adoptLegacy(
    keys: MailboxKeys,
    legacyToken: string,
    readers: MailboxReadTokens,
  ): Promise<boolean> {
    try {
      await this.channel.addReader(keys, legacyToken, readers.root);
      await this.channel.addReader(keys, legacyToken, readers.device);

      return true;
    } catch (error: unknown) {
      if (error instanceof MailboxUnavailableError) return false;

      throw error;
    }
  }

  /**
   * Creates the recipient inbox and enrols this device's reader before the
   * first read, so senders can append and the device reads without recovery.
   * Silent on failure: the read's own 404 recovery covers it.
   */
  private async ensureInbox(
    keys: MailboxKeys,
    readers: MailboxReadTokens,
  ): Promise<void> {
    try {
      await this.channel.createInbox(keys, readers.root);
      await this.channel.addReader(keys, readers.root, readers.device);
    } catch {
      // Count-only: no ids, content, or error details.
      // eslint-disable-next-line no-console
      console.debug('Direct mailbox inbox create failed; read will retry.');
    }
  }

  /**
   * The root token manages the reader set. The device token reads and acks
   * under this device's credential. Both derive from the identity root key.
   */
  private readersFor(session: Session, keys: MailboxKeys): MailboxReadTokens {
    const rootKey = session.masterKey.getBuffer();

    return {
      device: MailboxReadToken.deriveDevice(
        rootKey,
        keys.mailboxId,
        session.deviceCredentialKeyPair.toPrimitives().publicKey,
      ),
      root: MailboxReadToken.derive(rootKey, keys.mailboxId),
    };
  }

  /**
   * Reads from the stored cursor. An inbox re-created under that cursor
   * numbers its envelopes from 1 again, so it is read again from zero. The
   * reset is saved before the second read, so a crash cannot leave the new
   * inbox behind the old cursor.
   */
  private async readPage(
    inbox: RecipientInbox,
  ): Promise<{ cursor: number; page: OpenedMailboxPage }> {
    const { keys, readers, state } = inbox;
    const page = await this.channel.read(
      keys,
      readers,
      state.cursor,
      DirectMessageMailbox.PAGE_SIZE,
    );

    if (!page.recreated || state.cursor === 0) {
      return { cursor: state.cursor, page };
    }

    this.store.save(keys.mailboxId, { ...state, cursor: 0 });

    return {
      cursor: 0,
      page: await this.channel.read(
        keys,
        readers,
        0,
        DirectMessageMailbox.PAGE_SIZE,
      ),
    };
  }

  /**
   * Decodes and decrypts the page, hands its changes to the caller, then
   * acknowledges it. Each step checks the signal so an aborted pass neither
   * applies nor acks.
   */
  private async applyPage(
    session: Session,
    conversationId: string,
    inbox: RecipientInbox,
    page: OpenedMailboxPage,
    signal: AbortSignal,
    apply: (changes: DirectMessageTimelineChange[]) => void,
  ): Promise<void> {
    const { keys, readers, state } = inbox;
    const changes = await this.decryptPage(
      session,
      conversationId,
      page,
      signal,
    );

    if (signal.aborted) return;

    apply(changes);

    if (signal.aborted) return;

    const acked = await this.channel.acknowledge(
      keys,
      readers,
      page.lastCursor,
    );
    this.store.save(keys.mailboxId, {
      ...state,
      cursor: acked.recreated ? 0 : page.lastCursor,
    });
  }

  /**
   * Maps each decoded record to its timeline change, in envelope order. A
   * sent or edited record whose message does not decrypt drops only its own
   * change. Deletes and reactions carry no ciphertext and never decrypt.
   */
  private async decryptPage(
    session: Session,
    conversationId: string,
    page: OpenedMailboxPage,
    signal: AbortSignal,
  ): Promise<DirectMessageTimelineChange[]> {
    const records = page.envelopes.flatMap((envelope) => {
      const decoded = DirectMessageMailboxRecord.decode(
        envelope.plaintext,
        conversationId,
      );

      return decoded ? [decoded] : [];
    });
    const messages = await this.decryptMessages(
      session,
      conversationId,
      records,
      signal,
    );

    return records.flatMap((record): DirectMessageTimelineChange[] => {
      switch (record.type) {
        case 'sent':
        case 'edited': {
          const message = messages.get(record.id);

          if (!message || message.encrypted) return [];

          return [
            record.type === 'sent'
              ? { kind: 'message', message }
              : { kind: 'edit', message },
          ];
        }
        case 'deleted':
          return [{ kind: 'removed', messageId: record.targetMessageId }];
        case 'reaction':
          return [
            {
              action: record.action,
              authorId: record.authorId,
              createdAt: record.createdAt,
              emoji: record.emoji,
              kind: 'reaction',
              messageId: record.targetMessageId,
            },
          ];
      }
    });
  }

  /**
   * One batch decrypt for the sent and edited records of a page, keyed by
   * message id. Makes no call when the page has none.
   */
  private async decryptMessages(
    session: Session,
    conversationId: string,
    records: DirectMessageRecord[],
    signal: AbortSignal,
  ): Promise<Map<string, ChatMessage>> {
    const resources = records.flatMap((record) =>
      record.type === 'sent' || record.type === 'edited'
        ? [DirectMessageMailboxRecord.toResource(record)]
        : [],
    );

    if (resources.length === 0) return new Map();

    const messages = await this.projection.decryptMany(
      session,
      conversationId,
      resources,
      signal,
    );

    return new Map(
      messages.map((message): [string, ChatMessage] => [message.id, message]),
    );
  }

  private keysFor(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): MailboxKeys {
    const entry = ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    );

    if (!entry) throw new Error('Conversation key is required.');

    return MailboxKeySchedule.derive(
      Buffer.from(entry.key, 'base64'),
      recipientIdentityId,
      DirectMessageMailbox.EPOCH,
    );
  }
}
