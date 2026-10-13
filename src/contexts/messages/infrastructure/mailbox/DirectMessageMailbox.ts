import type { RealtimeMailboxSubscriptionInput } from '../../../../shared/infrastructure/realtime/RealtimeMailboxSubscriptionInput';
import type { ConversationResource } from '../../../conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';
import type { ChatMessage } from '../../presentation/view-models/ChatMessage';
import type { DirectMessageTimelineChange } from '../../presentation/view-models/DirectMessageTimelineChange';
import type { MessageProjectionPort } from '../crypto/MessageProjectionPort';
import type { PigeonMessageCommandsApi } from '../http/PigeonMessageCommandsApi';
import type { EditMessageOptions } from '../http/resources/EditMessageOptions';
import type { MessageCommandIdentity } from '../http/resources/MessageCommandIdentity';
import type { SendMessageOptions } from '../http/resources/SendMessageOptions';
import type { DirectMessageMailboxStore } from './DirectMessageMailboxStore';
import type {
  DirectMessageOutboxEvent,
  DirectMessageOutboxItem,
} from './DirectMessageOutbox';
import type { DirectMessageReaderSet } from './DirectMessageReaderSet';
import type { RecipientMailboxRouter } from './RecipientMailboxRouter';

import { DirectMessageHistoryStore } from './DirectMessageHistoryStore';
import { DirectMessageInboxOpener } from './DirectMessageInboxOpener';
import { DirectMessageOutboxStore } from './DirectMessageOutboxStore';
import { DirectMessageOwnCopies } from './DirectMessageOwnCopies';
import { DirectMessageReadSync } from './DirectMessageReadSync';
import { DirectMessageSender } from './DirectMessageSender';
import { DirectMessageTimelineSync } from './DirectMessageTimelineSync';

/**
 * Direct one-to-one messages over the opaque mailbox: sent, edited, deleted,
 * reactions, pins, and read receipts. Each action goes to the peer's inbox
 * first, then to this identity's own inbox, so its other devices converge.
 * Duplicates collapse by message id in the timeline.
 *
 * The facade keeps the public API. The work lives in collaborators: the
 * sender, the inbox opener, the timeline sync pass, and the read sync pass.
 */
export class DirectMessageMailbox {
  private readonly inboxes: DirectMessageInboxOpener;
  private readonly sender: DirectMessageSender;
  private readonly timeline: DirectMessageTimelineSync;
  private readonly reads: DirectMessageReadSync;
  private readonly history: DirectMessageHistoryStore;

  public constructor(
    channel: MailboxChannel,
    recipients: RecipientMailboxRouter,
    store: DirectMessageMailboxStore,
    projection: Pick<MessageProjectionPort, 'decrypt' | 'decryptMany'>,
    readerSet: DirectMessageReaderSet,
    composer: Pick<PigeonMessageCommandsApi, 'composeEdit' | 'withSentRecord'>,
  ) {
    const ownCopies = new DirectMessageOwnCopies();

    this.inboxes = new DirectMessageInboxOpener(channel, store, readerSet);
    this.sender = new DirectMessageSender(
      recipients,
      projection,
      composer,
      ownCopies,
      new DirectMessageOutboxStore(),
    );
    this.history = new DirectMessageHistoryStore();
    this.timeline = new DirectMessageTimelineSync(
      this.inboxes,
      channel,
      store,
      readerSet,
      projection,
      ownCopies,
      this.history,
    );
    this.reads = new DirectMessageReadSync(channel, store);
  }

  /**
   * The own inbox and this device's read token, as a realtime hint names them.
   * Null until the inbox is open on this device: the node silently ignores a
   * subscription for a reader it has not enrolled. Makes no node call.
   */
  public hintTarget(
    session: Session,
    conversationId: string,
  ): RealtimeMailboxSubscriptionInput | null {
    return this.inboxes.hintTarget(session, conversationId);
  }

  /**
   * Sender. Queues a message to the peer's inbox and this identity's own inbox
   * in the durable outbox. Resolves once queued; delivery continues in the
   * background. Rejects before anything is persisted.
   */
  public async send(
    session: Session,
    conversation: ConversationResource,
    content: string,
    options: SendMessageOptions,
    commandIdentity?: MessageCommandIdentity,
  ): Promise<ChatMessage> {
    return await this.sender.send(
      session,
      conversation,
      content,
      options,
      commandIdentity,
    );
  }

  /** Sender. Edits a sent message. Rejects like send. */
  public async edit(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
    content: string,
    options: EditMessageOptions,
  ): Promise<ChatMessage> {
    return await this.sender.edit(
      session,
      conversation,
      messageId,
      content,
      options,
    );
  }

  /** Sender. Deletes a message by id. Rejects like send. */
  public async delete(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
  ): Promise<void> {
    await this.sender.delete(session, conversation, messageId);
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
    await this.sender.reaction(session, conversation, reaction);
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
    await this.sender.pin(session, conversation, pin);
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
    await this.sender.markRead(session, conversation, messageId);
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
    await this.timeline.sync(session, conversationId, signal, apply);
  }

  /**
   * Recipient. Replays this identity's stored history of the conversation
   * before its first sync pass, so the history shows again after re-login.
   * Never throws: a failed replay logs one count-only line, and the sync pass
   * still runs.
   */
  public async restore(
    session: Session,
    conversationId: string,
    signal: AbortSignal,
    apply: (changes: DirectMessageTimelineChange[]) => void,
  ): Promise<void> {
    try {
      await this.timeline.restore(session, conversationId, signal, apply);
    } catch {
      console.debug('Direct history restore failed');
    }
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
    await this.reads.syncReads(session, conversationId, signal, apply);
  }

  /**
   * Removes this device's reader from the inbox of every direct conversation,
   * so the node stops counting it against the reader cap. Best effort: a
   * failed removal is left to the reader prune that other devices run on
   * sync. Never throws.
   */
  public async releaseDeviceReaders(session: Session): Promise<void> {
    await this.inboxes.releaseDeviceReaders(session);
  }

  /**
   * Wipes this identity's stored direct history on this device. Called when the
   * device is forgotten. Never throws: the store logs its own failures.
   */
  public async forgetHistory(identityId: string): Promise<void> {
    await this.history.forget(identityId);
  }

  /**
   * Sender. Retries a one-to-one send held in the outbox. Resolves with its
   * message once re-queued, or null when the outbox holds no such send.
   * Rejects when the conversation is not one-to-one.
   */
  public async retry(
    session: Session,
    conversation: ConversationResource,
    messageId: string,
  ): Promise<ChatMessage | null> {
    return await this.sender.retry(session, conversation, messageId);
  }

  /** Sender. Re-queues the persisted sends of this identity after unlock. */
  public async resumeOutbox(session: Session): Promise<void> {
    await this.sender.resume(session);
  }

  /** Sender. Queued one-to-one sends of a conversation, each with its state. */
  public outboxItems(
    identityId: string,
    conversationId: string,
  ): DirectMessageOutboxItem[] {
    return this.sender.items(identityId, conversationId);
  }

  /** Sender. Queued one-to-one sends of a conversation, decrypted. */
  public async queuedMessages(
    session: Session,
    conversationId: string,
  ): Promise<ChatMessage[]> {
    return await this.sender.queued(session, conversationId);
  }

  /** Sender. Notifies on every outbox change. Returns the unsubscribe. */
  public subscribeOutbox(
    listener: (event: DirectMessageOutboxEvent) => void,
  ): () => void {
    return this.sender.subscribe(listener);
  }

  /** Sender. Stops this identity's sends in memory, for logout. */
  public stopOutbox(identityId: string): void {
    this.sender.stop(identityId);
  }

  /**
   * Sender. Cancels and wipes this identity's queued sends. Called when the
   * device is forgotten. Never throws.
   */
  public async cancelOutbox(identityId: string): Promise<void> {
    await this.sender.cancel(identityId);
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
    return await this.inboxes.openInboxes(session, conversations, signal);
  }
}
