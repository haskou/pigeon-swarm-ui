import { UUID } from '@haskou/value-objects';
import { Buffer } from 'buffer';

import type {
  ChatMessage,
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeMailboxSubscriptionInput } from '../../../../shared/infrastructure/realtime/RealtimeMailboxSubscriptionInput';
import type { MailboxKeys } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type {
  MailboxReadTokens,
  OpenedMailboxPage,
} from '../../../mailboxes/infrastructure/MailboxChannel';
import type { MessageProjectionPort } from '../crypto/MessageProjectionPort';
import type { PigeonMessageCommandsApi } from '../http/PigeonMessageCommandsApi';
import type { EditMessageOptions } from '../http/resources/EditMessageOptions';
import type { SendMessageOptions } from '../http/resources/SendMessageOptions';
import type {
  DirectEditedRecord,
  DirectMessageRecord,
  DirectReadRecord,
  DirectSentRecord,
} from './DirectMessageMailboxRecord';
import type { DirectMessageMailboxState } from './DirectMessageMailboxStore';
import type { DirectMessageReaderSet } from './DirectMessageReaderSet';
import type { RecipientMailboxRouter } from './RecipientMailboxRouter';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { ConversationKeychain } from '../../../identities/infrastructure/keychain/ConversationKeychain';
import { sessionRootKey } from '../../../identities/infrastructure/session/sessionRootKey';
import { MailboxCapability } from '../../../mailboxes/infrastructure/crypto/MailboxCapability';
import { MailboxEnvelopeCipher } from '../../../mailboxes/infrastructure/crypto/MailboxEnvelopeCipher';
import { MailboxKeySchedule } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import { MailboxReadToken } from '../../../mailboxes/infrastructure/crypto/MailboxReadToken';
import { MailboxUnavailableError } from '../../../mailboxes/infrastructure/http/MailboxUnavailableError';
import { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';
import { DirectMessageAuthorship } from './DirectMessageAuthorship';
import { DirectMessageMailboxRecord } from './DirectMessageMailboxRecord';
import { DirectMessageMailboxStore } from './DirectMessageMailboxStore';

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
  | {
      action: 'pin' | 'unpin';
      createdAt: number;
      kind: 'pin';
      messageId: string;
    }
  | { kind: 'read'; messageId: string }
  | { kind: 'removed'; messageId: string };

/**
 * How an open of one recipient inbox ended. 'rate-limited' is the node's
 * creation cap: the pass that hits it stops, and the next pass resumes.
 */
type InboxOutcome = 'failed' | 'open' | 'rate-limited';

/** Keys, reader tokens, and saved state for the inbox this device reads. */
type RecipientInbox = {
  keys: MailboxKeys;
  readers: MailboxReadTokens;
  outcome: InboxOutcome;
  state: DirectMessageMailboxState;
};

/** Count-only: no ids, content, or error details. */
function logAppendFailure(): void {
  // eslint-disable-next-line no-console
  console.debug('Direct mailbox append failed.');
}

/**
 * Direct one-to-one messages over the opaque mailbox: sent, edited, deleted,
 * reactions, pins, and read receipts. Each action goes to the peer's inbox
 * first, then to this identity's own inbox, so its other devices converge.
 * Duplicates collapse by message id in the timeline.
 */
export class DirectMessageMailbox {
  private static readonly PAGE_SIZE = 50;
  private static readonly EPOCH = 0;
  private static readonly OPEN_RETRY_MS = 60_000;
  private static readonly READ_PAGE_LIMIT = 4;
  private static readonly OWN_COPY_LIMIT = 512;

  private readonly opening = new Map<string, Promise<RecipientInbox>>();
  /** Inboxes whose last open failed, keyed by mailbox id, and when to retry. */
  private readonly retryOpenAt = new Map<string, number>();
  /**
   * Own copies this instance appended, keyed by identity and record id. A
   * replayed own copy is acknowledged but not applied: this device already
   * shows the action, and a stale replay could undo a later local delete.
   * Bounded by OWN_COPY_LIMIT; an evicted key applies again on replay.
   */
  private readonly ownCopyIds = new Set<string>();

  public constructor(
    private readonly channel: MailboxChannel,
    private readonly recipients: RecipientMailboxRouter,
    private readonly store: DirectMessageMailboxStore,
    private readonly projection: Pick<
      MessageProjectionPort,
      'decrypt' | 'decryptMany'
    >,
    private readonly readerSet: DirectMessageReaderSet,
    private readonly composer: Pick<
      PigeonMessageCommandsApi,
      'composeEdit' | 'withSentRecord'
    >,
  ) {}

  /**
   * The own inbox and this device's read token, as a realtime hint names them.
   * Null until the inbox is open on this device: the node silently ignores a
   * subscription for a reader it has not enrolled. Makes no node call.
   */
  public hintTarget(
    session: Session,
    conversationId: string,
  ): RealtimeMailboxSubscriptionInput | null {
    const entry = ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    );

    if (!entry) return null;

    const keys = this.keysFor(session, conversationId, session.identity.id);
    const stored = this.store.load(keys.mailboxId);

    if (stored === null || stored.readToken) return null;

    return {
      mailboxId: keys.mailboxId,
      readToken: this.readersFor(session, keys).device,
    };
  }

  /**
   * Sender. Sends a message to the peer's inbox, then to this identity's own
   * inbox. The composer builds the record and publishes its attachments, always
   * encrypted for the peer whatever the caller passes. Rejects when the peer
   * copy fails; then no own copy is written and no attachment settles.
   */
  public async send(
    session: Session,
    conversation: ConversationResource,
    content: string,
    options: SendMessageOptions,
  ): Promise<ChatMessage> {
    const recipientIdentityId = this.peerOf(session, conversation);

    const sent = await this.composer.withSentRecord(
      session,
      conversation.id,
      content,
      {
        ...options,
        attachmentUpload: {
          encryptLargeAttachments: true,
          encryptSmallAttachments: true,
          networkId: conversation.networkId,
          recipientIdentityId,
        },
      },
      async (record) => {
        await this.deliver(session, conversation.id, recipientIdentityId, () =>
          DirectMessageMailboxRecord.fromSent(conversation.id, record),
        );

        return record;
      },
    );

    return await this.projection.decrypt(session, conversation.id, sent);
  }

  /** Sender. Edits a sent message. Rejects like send. */
  public async edit(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
    content: string,
    options: EditMessageOptions,
  ): Promise<ChatMessage> {
    const recipientIdentityId = this.peerOf(session, conversation);
    const edited = await this.composer.composeEdit(
      session,
      conversation.id,
      messageId,
      content,
      options,
    );

    await this.deliver(session, conversation.id, recipientIdentityId, () =>
      DirectMessageMailboxRecord.fromEdited(conversation.id, edited),
    );

    return await this.projection.decrypt(session, conversation.id, edited);
  }

  /** Sender. Deletes a message by id. Rejects like send. */
  public async delete(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
  ): Promise<void> {
    const recipientIdentityId = this.peerOf(session, conversation);

    await this.deliver(session, conversation.id, recipientIdentityId, () => ({
      authorId: session.identity.id,
      conversationId: conversation.id,
      createdAt: Date.now(),
      id: UUID.generate().toString(),
      targetMessageId: messageId,
      type: 'deleted',
    }));
  }

  /** Sender. Adds or removes a reaction. Rejects like send. */
  public async reaction(
    session: Session,
    conversation: ConversationResource,
    reaction: {
      action: 'add' | 'remove';
      createdAt: number;
      emoji: string;
      messageId: string;
    },
  ): Promise<void> {
    const recipientIdentityId = this.peerOf(session, conversation);

    await this.deliver(session, conversation.id, recipientIdentityId, () => ({
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

  /** Sender. Pins or unpins a message. Rejects like send. */
  public async pin(
    session: Session,
    conversation: ConversationResource,
    pin: {
      action: 'pin' | 'unpin';
      createdAt: number;
      messageId: string;
    },
  ): Promise<void> {
    const recipientIdentityId = this.peerOf(session, conversation);

    await this.deliver(session, conversation.id, recipientIdentityId, () => ({
      action: pin.action,
      authorId: session.identity.id,
      conversationId: conversation.id,
      createdAt: pin.createdAt,
      id: UUID.generate().toString(),
      targetMessageId: pin.messageId,
      type: 'pin',
    }));
  }

  /**
   * Sender. Writes a read receipt to this identity's own inbox, so its other
   * devices clear unread. The peer never receives it. Never rejects: a failure
   * logs one count-only line. Writes nothing for a group conversation.
   */
  public async markRead(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
  ): Promise<void> {
    if (!DirectMessageMailboxRecord.isEligible(conversation.type)) return;

    try {
      await this.writeTo(session, conversation.id, session.identity.id, {
        authorId: session.identity.id,
        conversationId: conversation.id,
        createdAt: Date.now(),
        id: UUID.generate().toString(),
        targetMessageId: messageId,
        type: 'read',
      });
    } catch {
      logAppendFailure();
    }
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
   * Recipient, background pass for a conversation that no active pass reads.
   * It clears unread from this identity's own read receipts. It never
   * acknowledges and never moves the sync cursor: the active pass owns both.
   * It opens and decodes envelopes as the active pass does, keeps its own read
   * cursor, and builds no messages.
   *
   * A read clears unread only when no sent message from another identity
   * follows it, so an unread message is never hidden. A visit reads at most
   * READ_PAGE_LIMIT pages, and a clear applies only once it reaches the end of
   * the inbox. The pass reads only an inbox prewarm already opened on this
   * device, and never creates or adopts one.
   */
  public async syncReads(
    session: Session,
    conversationId: string,
    signal: AbortSignal,
    apply: (changes: DirectMessageTimelineChange[]) => void,
  ): Promise<void> {
    const keys = this.keysFor(session, conversationId, session.identity.id);

    if (!this.readsAllowed(keys.mailboxId, signal)) return;

    const readers = this.readersFor(session, keys);
    let cursor = this.store.loadReadCursor(keys.mailboxId) ?? 0;
    let pending: string | null = null;

    for (
      let visit = 0;
      visit < DirectMessageMailbox.READ_PAGE_LIMIT;
      visit += 1
    ) {
      const page = await this.channel.read(
        keys,
        readers,
        cursor,
        DirectMessageMailbox.PAGE_SIZE,
      );

      if (signal.aborted) return;

      if (page.recreated && cursor > 0) {
        // Re-created inbox: its envelopes number from 1 again.
        cursor = 0;
        pending = null;
        this.store.saveReadCursor(keys.mailboxId, cursor);
        continue;
      }

      pending = this.pendingRead(session, conversationId, page, pending);
      cursor = this.advanceReadCursor(keys.mailboxId, cursor, page.lastCursor);

      if (!page.hasMore) {
        this.clearUnread(pending, apply);

        return;
      }
    }
  }

  /** Reads only an inbox prewarm already opened, without a legacy readToken. */
  private readsAllowed(mailboxId: string, signal: AbortSignal): boolean {
    if (signal.aborted) return false;

    const stored = this.store.load(mailboxId);

    return stored !== null && !stored.readToken;
  }

  /** Saves the cursor when a page moved it forward, and returns the cursor. */
  private advanceReadCursor(
    mailboxId: string,
    cursor: number,
    lastCursor: number,
  ): number {
    if (lastCursor <= cursor) return cursor;

    this.store.saveReadCursor(mailboxId, lastCursor);

    return lastCursor;
  }

  /** Clears unread once the pass has reached the end of the inbox. */
  private clearUnread(
    pending: string | null,
    apply: (changes: DirectMessageTimelineChange[]) => void,
  ): void {
    if (pending !== null) apply([{ kind: 'read', messageId: pending }]);
  }

  /**
   * Removes this device's reader from the inbox of every direct conversation,
   * so the node stops counting it against the reader cap. Best effort: a
   * failed removal is left to the reader prune that other devices run on
   * sync. Never throws.
   */
  public async releaseDeviceReaders(session: Session): Promise<void> {
    const conversations = Object.values(session.keychain.conversations).filter(
      (entry) => entry.kind === 'conversation',
    );

    for (const entry of conversations) {
      try {
        const keys = this.keysFor(
          session,
          entry.conversationId,
          session.identity.id,
        );
        const readers = this.readersFor(session, keys);

        await this.channel.removeReader(
          keys,
          readers.root,
          MailboxCapability.hash(readers.device),
        );
      } catch {
        // Count-only: no ids, content, or error details.
        // eslint-disable-next-line no-console
        console.debug('Direct mailbox reader release failed; pruned on sync.');
      }
    }
  }

  /**
   * Recipient. Opens the inbox of every one-to-one conversation this identity
   * holds a key for, so senders can deliver before this device has read it.
   * Opens run one at a time. A rate-limited open ends the pass, and a failed
   * open is retried once OPEN_RETRY_MS has passed. Resolves true when every
   * eligible inbox is open. Never throws.
   */
  public async openInboxes(
    session: Session,
    conversations: readonly ConversationResource[],
    signal: AbortSignal,
  ): Promise<boolean> {
    const eligible = conversations.filter(
      (conversation) =>
        DirectMessageMailboxRecord.isEligible(conversation.type) &&
        ConversationKeychain.entry(
          session.keychain,
          session.identity.id,
          conversation.id,
        ) !== undefined,
    );
    let complete = true;

    for (const conversation of eligible) {
      if (signal.aborted) return false;

      const outcome = await this.openRecipientInbox(session, conversation.id);

      if (outcome !== 'open') {
        complete = false;

        if (outcome === 'rate-limited') break;
      }
    }

    return complete && !signal.aborted;
  }

  /**
   * The peer of a one-to-one conversation. Throws before any write when the
   * conversation is a group or has no other participant.
   */
  private peerOf(session: Session, conversation: ConversationResource): string {
    const peer = conversation.participantIds.find(
      (identityId) => identityId !== session.identity.id,
    );

    if (!peer || !DirectMessageMailboxRecord.isEligible(conversation.type)) {
      throw new Error('Direct mailbox needs a one-to-one conversation.');
    }

    return peer;
  }

  /**
   * Sender path shared by every direct write. Builds the record once, so the
   * peer copy and the own copy carry the same id. The peer copy goes first; its
   * failure rejects with the original error and no own copy is written.
   */
  private async deliver(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
    build: () => DirectMessageRecord,
  ): Promise<void> {
    const record = build();

    await this.writeTo(session, conversationId, recipientIdentityId, record);

    this.rememberOwnCopy(`${session.identity.id}:${record.id}`);
    await this.appendOwnCopy(session, conversationId, record);
  }

  /**
   * The own copy is additive: a failure after the peer copy logs one
   * count-only line and resolves, so it never changes what the caller sees.
   */
  private async appendOwnCopy(
    session: Session,
    conversationId: string,
    record: DirectMessageRecord,
  ): Promise<void> {
    try {
      await this.writeTo(session, conversationId, session.identity.id, record);
    } catch {
      logAppendFailure();
    }
  }

  /**
   * Encodes a record for one inbox. Only this identity's own inbox gets the
   * authorship tag, because only that inbox is checked for it on read.
   */
  private encodeFor(
    session: Session,
    recipientIdentityId: string,
    record: DirectMessageRecord,
  ): Uint8Array {
    return DirectMessageMailboxRecord.encode(
      record,
      recipientIdentityId === session.identity.id
        ? DirectMessageAuthorship.tag(session.masterKey.getBuffer(), record)
        : undefined,
    );
  }

  /**
   * Encodes one record for one inbox, enforces the envelope bound, and appends
   * it through the recipient router. Throws before any append when the record
   * is over the bound, so nothing is written.
   */
  private async writeTo(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
    record: DirectMessageRecord,
  ): Promise<void> {
    const plaintext = this.encodeFor(session, recipientIdentityId, record);

    if (plaintext.byteLength > MailboxEnvelopeCipher.MAX_PLAINTEXT_BYTES) {
      throw new Error('Direct mailbox record exceeds the envelope bound.');
    }

    const keys = this.keysFor(session, conversationId, recipientIdentityId);

    await this.recipients.send(recipientIdentityId, keys, plaintext);
  }

  /** Remembers an own copy so its replay is not applied. Bounded. */
  private rememberOwnCopy(id: string): void {
    this.ownCopyIds.add(id);

    if (this.ownCopyIds.size > DirectMessageMailbox.OWN_COPY_LIMIT) {
      // Insertion order: the first id is the oldest own copy.
      const [oldest] = this.ownCopyIds;

      this.ownCopyIds.delete(oldest);
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
      return await this.reopenInbox(session, keys, readers, stored);
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

        return await this.reopenInbox(session, keys, readers, adopted);
      }
    }

    const state = { cursor: 0 };
    const outcome = await this.ensureInbox(session, keys, readers);

    // Saved only once the inbox exists with this device's reader, so a failed
    // open leaves nothing stored and the next pass opens it again.
    if (outcome === 'open') {
      this.store.save(keys.mailboxId, state);
    }

    return { keys, outcome, readers, state };
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
   * Opens through the shared open. A throw from the legacy adoption or the
   * reader prune counts as a failed open, so the pass moves on.
   */
  private async openRecipientInbox(
    session: Session,
    conversationId: string,
  ): Promise<InboxOutcome> {
    try {
      return (await this.openInboxShared(session, conversationId)).outcome;
    } catch {
      // Count-only: no ids, content, or error details.
      // eslint-disable-next-line no-console
      console.debug('Direct mailbox inbox open failed; retried later.');

      return 'failed';
    }
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
   * Opens an inbox that already exists under the stored state. The sealed root
   * bridges in first. A refused bridge leaves this device's sealed reader
   * unregistered, so reads use its legacy reader, which stays registered until
   * every credential bridges. The bridge retries on the next pass.
   */
  private async reopenInbox(
    session: Session,
    keys: MailboxKeys,
    readers: MailboxReadTokens,
    state: RecipientInbox['state'],
  ): Promise<RecipientInbox> {
    if (await this.enrolSealed(session, keys, readers)) {
      return { keys, outcome: 'open', readers, state };
    }

    return {
      keys,
      outcome: 'failed',
      readers: this.readersFor(session, keys, session.masterKey.getBuffer()),
      state,
    };
  }

  /**
   * Creates the recipient inbox and enrols this device's reader before the
   * first read, so senders can append and the device reads without recovery.
   * A failed open is not retried for OPEN_RETRY_MS, so sync passes do not
   * repeat the proof of work on every tick. Never throws: the read's own 404
   * recovery covers a missing inbox.
   */
  private async ensureInbox(
    session: Session,
    keys: MailboxKeys,
    readers: MailboxReadTokens,
  ): Promise<InboxOutcome> {
    const retryAt = this.retryOpenAt.get(keys.mailboxId);

    if (retryAt !== undefined && Date.now() < retryAt) {
      return 'failed';
    }

    try {
      await this.provisionInbox(session, keys, readers);
      this.retryOpenAt.delete(keys.mailboxId);

      return 'open';
    } catch (error: unknown) {
      this.retryOpenAt.set(
        keys.mailboxId,
        Date.now() + DirectMessageMailbox.OPEN_RETRY_MS,
      );
      // Count-only: no ids, content, or error details.
      // eslint-disable-next-line no-console
      console.debug('Direct mailbox inbox create failed; read will retry.');

      return error instanceof HttpJsonError && error.status === 429
        ? 'rate-limited'
        : 'failed';
    }
  }

  /**
   * Creates the inbox with this device's reader. A 409 means the inbox already
   * exists under another root, so a sealed root bridges into it instead.
   */
  private async provisionInbox(
    session: Session,
    keys: MailboxKeys,
    readers: MailboxReadTokens,
  ): Promise<void> {
    try {
      await this.channel.createInbox(keys, readers.root);
    } catch (error: unknown) {
      if (
        !(error instanceof HttpJsonError && error.status === 409) ||
        !session.deviceSealedRootKey
      ) {
        throw error;
      }
      await this.readerSet.enrolSealedRoot(session, keys, readers);

      return;
    }
    await this.channel.addReader(keys, readers.root, readers.device);
  }

  /**
   * Bridges the device-sealed root into the inbox. Without a sealed root the
   * legacy readers still serve the device, so there is nothing to bridge.
   */
  private async enrolSealed(
    session: Session,
    keys: MailboxKeys,
    readers: MailboxReadTokens,
  ): Promise<boolean> {
    if (!session.deviceSealedRootKey) return true;

    try {
      await this.readerSet.enrolSealedRoot(session, keys, readers);

      return true;
    } catch {
      // Count-only: no ids, content, or error details.
      // eslint-disable-next-line no-console
      console.debug('Direct mailbox sealed root bridge failed; retried later.');

      return false;
    }
  }

  /**
   * The root token manages the reader set. The device token reads and acks
   * under this device's credential. Both derive from the root key: the session
   * root by default, the legacy master key after a refused sealed bridge.
   */
  private readersFor(
    session: Session,
    keys: MailboxKeys,
    rootKey = sessionRootKey(session).getBuffer(),
  ): MailboxReadTokens {
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
        (record, authorTag) =>
          DirectMessageAuthorship.isAuthentic(
            session.identity.id,
            session.masterKey.getBuffer(),
            record,
            authorTag,
          ),
      );

      if (!decoded) return [];

      // An own copy this device appended is already shown locally.
      if (this.ownCopyIds.has(`${session.identity.id}:${decoded.id}`)) {
        return [];
      }

      return [decoded];
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
        case 'edited':
          return this.messageChanges(record, messages);
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
        case 'pin':
          return [
            {
              action: record.action,
              createdAt: record.createdAt,
              kind: 'pin',
              messageId: record.targetMessageId,
            },
          ];
        case 'read':
          return this.readChanges(session, record);
      }
    });
  }

  /**
   * A sent or edited record yields a change only when its message decrypted.
   */
  private messageChanges(
    record: DirectEditedRecord | DirectSentRecord,
    messages: Map<string, ChatMessage>,
  ): DirectMessageTimelineChange[] {
    const message = messages.get(record.id);

    if (!message || message.encrypted) return [];

    return [
      record.type === 'sent'
        ? { kind: 'message', message }
        : { kind: 'edit', message },
    ];
  }

  /**
   * A read receipt applies only when this identity wrote it and it is fresh.
   */
  private readChanges(
    session: Session,
    record: DirectReadRecord,
  ): DirectMessageTimelineChange[] {
    return this.isOwnFreshRead(session, record)
      ? [{ kind: 'read', messageId: record.targetMessageId }]
      : [];
  }

  /** Own read receipts only, and only while they are fresh. */
  private isOwnFreshRead(session: Session, record: DirectReadRecord): boolean {
    return (
      record.authorId === session.identity.id &&
      DirectMessageMailboxRecord.isFreshReceipt(record, Date.now())
    );
  }

  /**
   * The read a page leaves pending. A fresh read of this identity sets it, and
   * a sent message from another identity after it clears it, since that
   * message is unread. Other records leave it as it is.
   */
  private pendingRead(
    session: Session,
    conversationId: string,
    page: OpenedMailboxPage,
    pending: string | null,
  ): string | null {
    let next = pending;

    for (const envelope of page.envelopes) {
      const record = DirectMessageMailboxRecord.decode(
        envelope.plaintext,
        conversationId,
        (decodedRecord, authorTag) =>
          DirectMessageAuthorship.isAuthentic(
            session.identity.id,
            session.masterKey.getBuffer(),
            decodedRecord,
            authorTag,
          ),
      );

      if (record?.type === 'read' && this.isOwnFreshRead(session, record)) {
        next = record.targetMessageId;
      } else if (
        record?.type === 'sent' &&
        record.authorId !== session.identity.id
      ) {
        next = null;
      }
    }

    return next;
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
