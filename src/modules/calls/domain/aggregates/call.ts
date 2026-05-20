import { DomainError, Timestamp } from '@haskou/value-objects';

import type {
  CallParticipantStatus,
  CallResource,
  CallResourceParticipant,
} from '../callSession.types';

import { AggregateRoot } from '../../../../shared/domain/aggregateRoot';
import { CallId } from '../value-objects/callId';
import { CallIdentityId } from '../value-objects/callIdentityId';
import { CallStatus } from '../value-objects/callStatus';

export class Call extends AggregateRoot {
  private constructor(
    private readonly id: CallId,
    private status: CallStatus,
    private readonly resource: CallResource,
    private participants: CallResourceParticipant[],
    private endedAt?: Timestamp,
  ) {
    super();
  }

  public static fromResource(resource: CallResource): Call {
    return new Call(
      CallId.fromString(resource.id),
      CallStatus.fromPrimitive(resource.status),
      resource,
      resource.participants,
      resource.endedAt ? new Timestamp(resource.endedAt) : undefined,
    );
  }

  public end(endedAt: Timestamp): void {
    if (this.status.isEnded()) return;

    this.status = CallStatus.ended();
    this.endedAt = endedAt;
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: Date.now(),
      type: 'CallEnded',
    });
  }

  public getId(): CallId {
    return this.id;
  }

  public hasParticipantStatus(
    identityId: CallIdentityId,
    status: CallParticipantStatus,
  ): boolean {
    return this.participants.some(
      (participant) =>
        CallIdentityId.fromString(participant.identityId).isEqual(identityId) &&
        participant.status === status,
    );
  }

  public isActive(): boolean {
    return this.status.isActive();
  }

  public joinParticipant(
    identityId: CallIdentityId,
    joinedAt: Timestamp,
  ): void {
    if (!this.status.isActive()) {
      throw new DomainError('Only active calls can be joined.');
    }

    this.participants = this.withParticipantStatus(
      identityId,
      'joined',
      joinedAt,
    );
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: Date.now(),
      type: 'CallParticipantJoined',
    });
  }

  public markParticipantMissed(
    identityId: CallIdentityId,
    missedAt: Timestamp,
  ): void {
    this.participants = this.withParticipantStatus(
      identityId,
      'missed',
      missedAt,
    );
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: Date.now(),
      type: 'CallParticipantMissed',
    });
  }

  public toResource(): CallResource {
    return {
      ...this.resource,
      endedAt: this.endedAt?.valueOf(),
      participants: this.participants,
      status: this.status.toString() as CallResource['status'],
    };
  }

  private withParticipantStatus(
    identityId: CallIdentityId,
    status: CallParticipantStatus,
    timestamp: Timestamp,
  ): CallResourceParticipant[] {
    return this.participants.map((participant) => {
      if (
        CallIdentityId.fromString(participant.identityId).isNotEqual(identityId)
      ) {
        return participant;
      }

      return {
        ...participant,
        declinedAt:
          status === 'declined' ? timestamp.valueOf() : participant.declinedAt,
        joinedAt:
          status === 'joined' ? timestamp.valueOf() : participant.joinedAt,
        leftAt: status === 'left' ? timestamp.valueOf() : participant.leftAt,
        missedAt:
          status === 'missed' ? timestamp.valueOf() : participant.missedAt,
        status,
      };
    });
  }
}
