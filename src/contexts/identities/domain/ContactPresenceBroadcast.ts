import { Duration, type Timestamp } from '@haskou/value-objects';

import type { PresenceSharing } from './PresenceSharing';
import type { ContactPresenceSource } from './value-objects/ContactPresenceSource';
import type { IdentityId } from './value-objects/IdentityId';
import type { IdentityPresenceStatus } from './value-objects/IdentityPresenceStatus';

import { ContactPresence } from './ContactPresence';
import { ContactPresenceSequence } from './value-objects/ContactPresenceSequence';

type SentContactPresence = {
  at: Timestamp;
  sharing: PresenceSharing;
  status: IdentityPresenceStatus | null;
};

/**
 * This app session's presence stream to the contacts it shares with. A
 * change goes out at most once every 10 seconds per contact, and an unchanged
 * status is refreshed every 45 seconds, well inside its 90-second lifetime.
 * Invisible and disconnected send nothing: contacts see the last update
 * expire.
 */
export class ContactPresenceBroadcast {
  public static readonly MIN_INTERVAL = Duration.fromSeconds(10);
  public static readonly REFRESH_INTERVAL = Duration.fromSeconds(45);

  private sequence: ContactPresenceSequence | null = null;
  private sent: SentContactPresence[] = [];

  public constructor(
    private readonly authorId: IdentityId,
    private readonly source: ContactPresenceSource,
  ) {}

  private isDue(
    last: SentContactPresence,
    status: IdentityPresenceStatus,
    now: Timestamp,
  ): boolean {
    if (now.isBefore(last.at.addDuration(ContactPresenceBroadcast.MIN_INTERVAL)))
      return false;

    return (
      !last.status?.isEqual(status) ||
      !now.isBefore(
        last.at.addDuration(ContactPresenceBroadcast.REFRESH_INTERVAL),
      )
    );
  }

  /** The update due for this contact now, if any. */
  public next(
    sharing: PresenceSharing,
    status: IdentityPresenceStatus,
    now: Timestamp,
  ): ContactPresence | null {
    const last = this.sent.find((sent) => sent.sharing.isSameAs(sharing));

    if (!status.isSharedWithContacts()) {
      if (last) last.status = null;

      return null;
    }

    if (last && !this.isDue(last, status, now)) return null;

    this.sequence = this.sequence?.next() ?? ContactPresenceSequence.first();
    this.sent = [
      ...this.sent.filter((sent) => sent !== last),
      { at: now, sharing, status },
    ];

    return ContactPresence.create(
      this.authorId,
      this.source,
      this.sequence,
      status,
      now,
    );
  }
}
