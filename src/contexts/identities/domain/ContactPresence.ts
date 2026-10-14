import { Duration, Timestamp, assert } from '@haskou/value-objects';

import { IdentityPresence } from './IdentityPresence';
import { InvalidContactPresenceError } from './errors/InvalidContactPresenceError';
import { UnshareablePresenceStatusError } from './errors/UnshareablePresenceStatusError';
import { ContactPresenceSequence } from './value-objects/ContactPresenceSequence';
import { ContactPresenceSource } from './value-objects/ContactPresenceSource';
import { IdentityId } from './value-objects/IdentityId';
import { IdentityPresenceStatus } from './value-objects/IdentityPresenceStatus';

/**
 * One presence update a contact sent: its status for at most 90 seconds,
 * numbered within the sender's presence source. It carries no node, device or
 * network identifier.
 */
export class ContactPresence {
  public static readonly LIFETIME = Duration.fromSeconds(90);

  private static rank(status: IdentityPresenceStatus): number {
    return [
      IdentityPresenceStatus.AWAY,
      IdentityPresenceStatus.AVAILABLE,
      IdentityPresenceStatus.BUSY,
    ].findIndex((ranked) => ranked.isEqual(status));
  }

  public static create(
    authorId: IdentityId,
    source: ContactPresenceSource,
    sequence: ContactPresenceSequence,
    status: IdentityPresenceStatus,
    sentAt: Timestamp,
  ): ContactPresence {
    return new ContactPresence(
      authorId,
      source,
      sequence,
      status,
      sentAt,
      sentAt.addDuration(ContactPresence.LIFETIME),
    );
  }

  public static fromPrimitives(primitives: {
    authorId: string;
    expiresAt: number;
    sentAt: number;
    sequence: number;
    source: string;
    status: string;
  }): ContactPresence {
    assert(
      Number.isSafeInteger(primitives.sentAt) &&
        Number.isSafeInteger(primitives.expiresAt),
      new InvalidContactPresenceError(),
    );

    return new ContactPresence(
      IdentityId.fromString(primitives.authorId),
      ContactPresenceSource.fromString(primitives.source),
      ContactPresenceSequence.fromPrimitives(primitives.sequence),
      IdentityPresenceStatus.fromPrimitives(primitives.status),
      new Timestamp(primitives.sentAt),
      new Timestamp(primitives.expiresAt),
    );
  }

  private constructor(
    private readonly authorId: IdentityId,
    private readonly source: ContactPresenceSource,
    private readonly sequence: ContactPresenceSequence,
    private readonly status: IdentityPresenceStatus,
    private readonly sentAt: Timestamp,
    private readonly expiresAt: Timestamp,
  ) {
    assert(status.isSharedWithContacts(), new UnshareablePresenceStatusError());
    assert(
      expiresAt.isAfter(sentAt) &&
        expiresAt.isBeforeOrEqual(sentAt.addDuration(ContactPresence.LIFETIME)),
      new InvalidContactPresenceError(),
    );
  }

  /**
   * When this update stops counting for a receiver: its own expiry, capped at
   * one lifetime after it arrived, so a sender clock running ahead cannot keep
   * it alive.
   */
  public expiresOnReceiptAt(receivedAt: Timestamp): Timestamp {
    const cap = receivedAt.addDuration(ContactPresence.LIFETIME);

    return this.expiresAt.isBefore(cap) ? this.expiresAt : cap;
  }

  /** The later of the sender's expiry and the receiver-side cap. */
  public forgottenAfter(receivedAt: Timestamp): Timestamp {
    const cap = receivedAt.addDuration(ContactPresence.LIFETIME);

    return this.expiresAt.isAfter(cap) ? this.expiresAt : cap;
  }

  public isExpiredAt(now: Timestamp): boolean {
    return this.expiresAt.isBeforeOrEqual(now);
  }

  public isFrom(identityId: IdentityId): boolean {
    return this.authorId.isEqual(identityId);
  }

  public isSameSourceAs(other: ContactPresence): boolean {
    return (
      this.authorId.isEqual(other.authorId) && this.source.isEqual(other.source)
    );
  }

  public follows(other: ContactPresence): boolean {
    return this.sequence.isGreaterThan(other.sequence);
  }

  /**
   * Between updates of one contact that are both current: busy wins over
   * available, and available over away.
   */
  public outranks(other: ContactPresence): boolean {
    return (
      ContactPresence.rank(this.status) > ContactPresence.rank(other.status)
    );
  }

  public toIdentityPresence(observedAt: Timestamp): IdentityPresence {
    return IdentityPresence.observed(this.authorId, this.status, observedAt);
  }

  public toPrimitives() {
    return {
      authorId: this.authorId.toString(),
      expiresAt: this.expiresAt.valueOf(),
      sentAt: this.sentAt.valueOf(),
      sequence: this.sequence.valueOf(),
      source: this.source.toString(),
      status: this.status.valueOf(),
    };
  }
}
