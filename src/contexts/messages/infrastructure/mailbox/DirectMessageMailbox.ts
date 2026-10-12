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
import type { DirectMessageMailboxState } from './DirectMessageMailboxStore';
import type { DirectMessageReaderSet } from './DirectMessageReaderSet';

import { ConversationKeychain } from '../../../identities/infrastructure/keychain/ConversationKeychain';
import { MailboxKeySchedule } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import { MailboxReadToken } from '../../../mailboxes/infrastructure/crypto/MailboxReadToken';
import { MailboxUnavailableError } from '../../../mailboxes/infrastructure/http/MailboxUnavailableError';
import { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';
import { DirectMessageMailboxRecord } from './DirectMessageMailboxRecord';
import { DirectMessageMailboxStore } from './DirectMessageMailboxStore';

export type DirectMessageMailboxDelivery = 'delivered' | 'failed' | 'skipped';

/** What the outgoing message carries beyond text. */
export type DirectMessageOutgoing = {
  attachmentCount: number;
  hasReply: boolean;
  hasSticker: boolean;
};

/** Keys, reader tokens, and saved state for the inbox this device reads. */
type RecipientInbox = {
  keys: MailboxKeys;
  readers: MailboxReadTokens;
  state: DirectMessageMailboxState;
};

/**
 * Direct one-to-one text over the opaque mailbox. The legacy send delivers
 * first; this path carries a copy so the peer can receive it without the
 * replicated path. Duplicates collapse by message id in the timeline.
 */
export class DirectMessageMailbox {
  private static readonly PAGE_SIZE = 50;
  private static readonly EPOCH = 0;

  public constructor(
    private readonly channel: MailboxChannel,
    private readonly store: DirectMessageMailboxStore,
    private readonly projection: Pick<MessageProjectionPort, 'decryptMany'>,
    private readonly readerSet: DirectMessageReaderSet,
  ) {}

  /**
   * Sender. Appends the already-sent record to the peer's inbox. Returns
   * 'skipped' when there is no peer or the message is not eligible, which
   * leaves it on the legacy path only. Never throws: any failure, including
   * 404 for an inbox the peer has not opened yet, returns 'failed'. The caller
   * keeps the legacy copy and shows nothing to the user.
   */
  public async deliver(
    session: Session,
    conversation: ConversationResource,
    sent: MessageResource,
    outgoing: DirectMessageOutgoing,
  ): Promise<DirectMessageMailboxDelivery> {
    const recipientIdentityId = conversation.participantIds.find(
      (identityId) => identityId !== session.identity.id,
    );

    if (
      !recipientIdentityId ||
      !DirectMessageMailboxRecord.isEligible({
        ...outgoing,
        conversationType: conversation.type,
      })
    ) {
      return 'skipped';
    }

    try {
      const keys = this.keysFor(session, conversation.id, recipientIdentityId);
      const record = DirectMessageMailboxRecord.fromSent(conversation.id, sent);

      await this.channel.send(keys, DirectMessageMailboxRecord.encode(record));

      return 'delivered';
    } catch {
      // Count-only: no ids, content, or error details.
      // eslint-disable-next-line no-console
      console.debug('Direct mailbox append failed; legacy copy kept.');

      return 'failed';
    }
  }

  /**
   * Recipient. Reads the next page of this identity's inbox, applies decrypted
   * messages, then acknowledges. The cursor advances only after the
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
    apply: (messages: ChatMessage[]) => void,
  ): Promise<void> {
    if (signal.aborted) return;

    const inbox = await this.openInbox(session, conversationId);

    if (signal.aborted) return;

    await this.readerSet.reconcile(session, inbox.keys, inbox.readers);

    if (signal.aborted) return;

    const { cursor, page } = await this.readPage(inbox);

    if (page.lastCursor <= cursor || signal.aborted) return;

    await this.applyPage(session, conversationId, inbox, page, signal, apply);
  }

  /**
   * Resolves the inbox keys, reader tokens, and saved state. A stored legacy
   * token is adopted into the reader set first. The derived tokens are never
   * persisted.
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

    if (
      stored?.readToken &&
      (await this.adoptLegacy(keys, stored.readToken, readers))
    ) {
      const adopted = { cursor: stored.cursor };

      this.store.save(keys.mailboxId, adopted);

      return { keys, readers, state: adopted };
    }

    const state = { cursor: 0 };

    // Saved before the create, so a concurrent pass takes the same path and
    // shares the in-flight create (see MailboxChannel.createInbox).
    this.store.save(keys.mailboxId, state);
    await this.ensureInbox(keys, readers);

    return { keys, readers, state };
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
   * Decrypts the page, hands it to the caller, then acknowledges it. Each
   * step checks the signal so an aborted pass neither applies nor acks.
   */
  private async applyPage(
    session: Session,
    conversationId: string,
    inbox: RecipientInbox,
    page: OpenedMailboxPage,
    signal: AbortSignal,
    apply: (messages: ChatMessage[]) => void,
  ): Promise<void> {
    const { keys, readers, state } = inbox;
    const messages = await this.decryptPage(
      session,
      conversationId,
      page,
      signal,
    );

    if (signal.aborted) return;

    apply(messages);

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

  private async decryptPage(
    session: Session,
    conversationId: string,
    page: OpenedMailboxPage,
    signal: AbortSignal,
  ): Promise<ChatMessage[]> {
    const records = page.envelopes.flatMap((envelope) => {
      const decoded = DirectMessageMailboxRecord.decode(
        envelope.plaintext,
        conversationId,
      );

      return decoded ? [decoded] : [];
    });

    if (records.length === 0) return [];

    return this.projection.decryptMany(
      session,
      conversationId,
      records,
      signal,
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
