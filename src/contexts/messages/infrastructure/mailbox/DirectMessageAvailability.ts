import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectMessageAvailabilityServer } from './DirectMessageAvailabilityServer';
import type { DirectMessageAvailabilityStore } from './DirectMessageAvailabilityStore';
import type { RecipientMailboxRouter } from './RecipientMailboxRouter';

import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { ConversationKeychain } from '../../../identities/infrastructure/keychain/ConversationKeychain';
import { DirectMessageAvailabilityAnnouncement } from './DirectMessageAvailabilityAnnouncement';
import { DirectMessageInboxKeys } from './DirectMessageInboxKeys';
import { DirectMessageMailboxLimits } from './DirectMessageMailboxLimits';

/**
 * Which availability servers hold each direct inbox. A recipient announces
 * the servers its inbox is open on inside the conversation, sealed in the
 * peer's inbox; a sender appends to the servers its peer announced. Only the
 * conversation peer can announce servers for its own inbox.
 */
export class DirectMessageAvailability {
  /** Own inboxes whose last announcement failed, and when to retry. */
  private readonly retryAnnounceAt = new Map<string, number>();

  public constructor(
    private readonly servers: readonly DirectMessageAvailabilityServer[],
    private readonly recipients: Pick<RecipientMailboxRouter, 'send'>,
    private readonly store: DirectMessageAvailabilityStore,
  ) {}

  /** Extra servers to append to: own picks for an own copy, else the peer's. */
  public serversFor(
    session: Session,
    recipientIdentityId: string,
    mailboxId: string,
  ): string[] {
    return IdentityId.fromString(recipientIdentityId).isEqual(
      IdentityId.fromString(session.identity.id),
    )
      ? this.servers.map((server) => server.base)
      : this.store.servers(mailboxId);
  }

  /**
   * Records an announcement read from this device's inbox, if the plaintext is
   * one the conversation peer wrote. Anything else is ignored.
   */
  public receive(
    session: Session,
    conversationId: string,
    plaintext: Uint8Array,
  ): void {
    const announcement = DirectMessageAvailabilityAnnouncement.decode(
      plaintext,
      conversationId,
    );
    const peerIdentityId = ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    )?.peerIdentityId;

    if (
      announcement === null ||
      peerIdentityId === undefined ||
      IdentityId.fromString(peerIdentityId).isEqual(
        IdentityId.fromString(session.identity.id),
      ) ||
      announcement.authorId !== peerIdentityId
    ) {
      return;
    }

    this.store.record(
      DirectMessageInboxKeys.keysFor(session, conversationId, peerIdentityId)
        .mailboxId,
      announcement.createdAt,
      announcement.servers,
    );
  }

  /**
   * Tells the peer which picked servers hold this device's inbox, when that
   * list changed since the last announcement. A failed announcement waits
   * before the next try. Logs count-only.
   */
  public async announce(
    session: Session,
    conversationId: string,
  ): Promise<void> {
    const peerIdentityId = ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversationId,
    )?.peerIdentityId;

    if (peerIdentityId === undefined) return;

    const ownMailboxId = DirectMessageInboxKeys.keysFor(
      session,
      conversationId,
      session.identity.id,
    ).mailboxId;
    const servers = this.servers
      .filter((server) => server.store.load(ownMailboxId) !== null)
      .map((server) => server.base);
    const announced = this.store.announced(ownMailboxId);

    if (
      servers.length === announced.length &&
      servers.every((base, index) => base === announced[index])
    ) {
      return;
    }

    if (Date.now() < (this.retryAnnounceAt.get(ownMailboxId) ?? 0)) return;

    const peerKeys = DirectMessageInboxKeys.keysFor(
      session,
      conversationId,
      peerIdentityId,
    );

    try {
      await this.recipients.send(
        peerIdentityId,
        this.store.servers(peerKeys.mailboxId),
        peerKeys,
        DirectMessageAvailabilityAnnouncement.encode({
          authorId: session.identity.id,
          conversationId,
          createdAt: Date.now(),
          servers,
        }),
      );
      this.store.saveAnnounced(ownMailboxId, servers);
      this.retryAnnounceAt.delete(ownMailboxId);
    } catch {
      this.retryAnnounceAt.set(
        ownMailboxId,
        Date.now() + DirectMessageMailboxLimits.OPEN_RETRY_MS,
      );
      // eslint-disable-next-line no-console
      console.debug('Direct mailbox availability announcement failed.');
    }
  }
}
