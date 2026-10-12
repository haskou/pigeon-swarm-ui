import type {
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeMailboxSubscriptionInput } from '../../../../shared/infrastructure/realtime/RealtimeMailboxSubscriptionInput';
import type { MailboxKeys } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type { MailboxReadTokens } from '../../../mailboxes/infrastructure/MailboxChannel';
import type { DirectMessageInboxOutcome } from './DirectMessageInboxOutcome';
import type { DirectMessageMailboxStore } from './DirectMessageMailboxStore';
import type { DirectMessageReaderSet } from './DirectMessageReaderSet';
import type { DirectMessageRecipientInbox } from './DirectMessageRecipientInbox';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { ConversationKeychain } from '../../../identities/infrastructure/keychain/ConversationKeychain';
import { MailboxCapability } from '../../../mailboxes/infrastructure/crypto/MailboxCapability';
import { MailboxUnavailableError } from '../../../mailboxes/infrastructure/http/MailboxUnavailableError';
import { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';
import { DirectMessageInboxKeys } from './DirectMessageInboxKeys';
import { DirectMessageMailboxLimits } from './DirectMessageMailboxLimits';
import { DirectMessageMailboxRecord } from './DirectMessageMailboxRecord';

/**
 * Recipient inbox open and reader enrolment: creates or adopts the inbox this
 * device reads, bridges its sealed root in, and releases readers on sign-out.
 */
export class DirectMessageInboxOpener {
  /** Overlapping passes share one open, keyed by identity and conversation. */
  private readonly opening = new Map<
    string,
    Promise<DirectMessageRecipientInbox>
  >();

  /** Inboxes whose last open failed, keyed by mailbox id, and when to retry. */
  private readonly retryOpenAt = new Map<string, number>();

  public constructor(
    private readonly channel: MailboxChannel,
    private readonly store: DirectMessageMailboxStore,
    private readonly readerSet: DirectMessageReaderSet,
  ) {}

  /**
   * Resolves the inbox keys, reader tokens, and saved state. A stored legacy
   * token first frees readers no device holds, then is adopted into the
   * reader set. The derived tokens are never persisted.
   */
  private async openInbox(
    session: Session,
    conversationId: string,
  ): Promise<DirectMessageRecipientInbox> {
    const keys = DirectMessageInboxKeys.keysFor(
      session,
      conversationId,
      session.identity.id,
    );
    const readers = DirectMessageInboxKeys.readersFor(session, keys);
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
    state: DirectMessageRecipientInbox['state'],
  ): Promise<DirectMessageRecipientInbox> {
    if (await this.enrolSealed(session, keys, readers)) {
      return { keys, outcome: 'open', readers, state };
    }

    return {
      keys,
      outcome: 'failed',
      readers: DirectMessageInboxKeys.readersFor(
        session,
        keys,
        session.masterKey.getBuffer(),
      ),
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
  ): Promise<DirectMessageInboxOutcome> {
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
        Date.now() + DirectMessageMailboxLimits.OPEN_RETRY_MS,
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
   * Recipient. Opens through the shared open. A throw from the legacy adoption
   * or the reader prune counts as a failed open, so the pass moves on.
   */
  private async openRecipientInbox(
    session: Session,
    conversationId: string,
  ): Promise<DirectMessageInboxOutcome> {
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
   * Overlapping passes share one open. A pass that starts while the inbox is
   * still being created awaits that create, so it never reads a missing inbox.
   */
  public openInboxShared(
    session: Session,
    conversationId: string,
  ): Promise<DirectMessageRecipientInbox> {
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

    const keys = DirectMessageInboxKeys.keysFor(
      session,
      conversationId,
      session.identity.id,
    );
    const stored = this.store.load(keys.mailboxId);

    if (stored === null || stored.readToken) return null;

    return {
      mailboxId: keys.mailboxId,
      readToken: DirectMessageInboxKeys.readersFor(session, keys).device,
    };
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
        const keys = DirectMessageInboxKeys.keysFor(
          session,
          entry.conversationId,
          session.identity.id,
        );
        const readers = DirectMessageInboxKeys.readersFor(session, keys);

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
}
