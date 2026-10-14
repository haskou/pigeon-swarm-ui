import type { Timestamp } from '@haskou/value-objects';

import type { ContactPresence } from './ContactPresence';
import type { IdentityId } from './value-objects/IdentityId';

import { IdentityPresence } from './IdentityPresence';
import { IdentityPresenceStatus } from './value-objects/IdentityPresenceStatus';

type HeldContactPresence = {
  presence: ContactPresence;
  receivedAt: Timestamp;
};

/**
 * What this device currently knows of its contacts' presence: the latest
 * update of each presence source, held in memory only. An update counts until
 * it expires, and its sequence is remembered until the update could no longer
 * be accepted, so a replayed or older update never brings a status back.
 */
export class ContactPresenceBoard {
  private held: HeldContactPresence[] = [];

  private evict(now: Timestamp): void {
    this.held = this.held.filter(({ presence, receivedAt }) =>
      presence.forgottenAfter(receivedAt).isAfter(now),
    );
  }

  /** Tells whether the update was taken; expired or stale ones are not. */
  public accept(presence: ContactPresence, receivedAt: Timestamp): boolean {
    this.evict(receivedAt);

    if (presence.isExpiredAt(receivedAt)) return false;

    const previous = this.held.find((held) =>
      held.presence.isSameSourceAs(presence),
    );

    if (previous && !presence.follows(previous.presence)) return false;

    this.held = [
      ...this.held.filter((held) => held !== previous),
      { presence, receivedAt },
    ];

    return true;
  }

  public forget(contactId: IdentityId): void {
    this.held = this.held.filter(({ presence }) => !presence.isFrom(contactId));
  }

  /**
   * The contact's status across its current sources, busy first, then
   * available, then away. Disconnected once none is current.
   */
  public presenceOf(contactId: IdentityId, now: Timestamp): IdentityPresence {
    this.evict(now);

    const current = this.held.filter(
      ({ presence, receivedAt }) =>
        presence.isFrom(contactId) &&
        presence.expiresOnReceiptAt(receivedAt).isAfter(now),
    );
    const winner = current.reduce<HeldContactPresence | null>(
      (best, held) =>
        !best || held.presence.outranks(best.presence) ? held : best,
      null,
    );

    return winner
      ? winner.presence.toIdentityPresence(winner.receivedAt)
      : IdentityPresence.observed(
          contactId,
          IdentityPresenceStatus.DISCONNECTED,
          now,
        );
  }
}
