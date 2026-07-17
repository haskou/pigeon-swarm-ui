import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import type { CallEnded } from './events/CallEnded';
import type { CallParticipantJoined } from './events/CallParticipantJoined';
import type { CallParticipantLeft } from './events/CallParticipantLeft';
import type { CallParticipantMissed } from './events/CallParticipantMissed';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { CallMediaConnection } from './entities/CallMediaConnection';
import { CallParticipant } from './entities/CallParticipant';
import { CallCannotBeJoinedError } from './errors/CallCannotBeJoinedError';
import { CallParticipantNotFoundError } from './errors/CallParticipantNotFoundError';
import { CallId } from './value-objects/CallId';
import { CallIdentityId } from './value-objects/CallIdentityId';
import { CallLifecycle } from './value-objects/CallLifecycle';
import { CallNetworkId } from './value-objects/CallNetworkId';
import { CallParticipantStatus } from './value-objects/CallParticipantStatus';
import { CallScope } from './value-objects/CallScope';

export class Call extends AggregateRoot {
  public static fromPrimitives(primitives: PrimitiveOf<Call>): Call {
    return new Call(
      CallId.fromString(primitives.id),
      CallIdentityId.fromString(primitives.creatorIdentityId),
      CallNetworkId.fromString(primitives.networkId),
      CallScope.fromPrimitives(primitives.scope),
      CallLifecycle.fromPrimitives(primitives),
      primitives.participants.map((participant) =>
        CallParticipant.fromPrimitives(participant),
      ),
    );
  }

  private constructor(
    private readonly id: CallId,
    private readonly creatorIdentityId: CallIdentityId,
    private readonly networkId: CallNetworkId,
    private readonly scope: CallScope,
    private lifecycle: CallLifecycle,
    private readonly participants: CallParticipant[],
  ) {
    super();
  }

  private participant(identityId: CallIdentityId): CallParticipant {
    const participant = this.participants.find((candidate) =>
      candidate.belongsTo(identityId),
    );

    if (!participant) throw new CallParticipantNotFoundError();

    return participant;
  }

  public end(endedAt: Timestamp): void {
    if (this.lifecycle.isEnded()) return;

    this.lifecycle = this.lifecycle.end(endedAt);
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: endedAt.valueOf(),
      type: 'CallEnded',
    } satisfies CallEnded);
  }

  public hasParticipantStatus(
    identityId: CallIdentityId,
    status: CallParticipantStatus,
  ): boolean {
    return this.participants.some(
      (participant) =>
        participant.belongsTo(identityId) && participant.hasStatus(status),
    );
  }

  public getId(): CallId {
    return this.id;
  }

  public heartbeatParticipant(
    identityId: CallIdentityId,
    at: Timestamp,
    mediaConnections: CallMediaConnection[],
  ): void {
    const participant = this.participant(identityId);

    participant.heartbeat(at);
    participant.updateMediaConnections(mediaConnections);
  }

  public isActive(): boolean {
    return this.lifecycle.isActive();
  }

  public joinParticipant(
    identityId: CallIdentityId,
    joinedAt: Timestamp,
  ): void {
    if (!this.lifecycle.isActive()) throw new CallCannotBeJoinedError();

    this.participant(identityId).join(joinedAt);
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: joinedAt.valueOf(),
      type: 'CallParticipantJoined',
    } satisfies CallParticipantJoined);
  }

  public leaveParticipant(identityId: CallIdentityId, leftAt: Timestamp): void {
    this.participant(identityId).leave(leftAt);
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: leftAt.valueOf(),
      type: 'CallParticipantLeft',
    } satisfies CallParticipantLeft);
  }

  public markParticipantMissed(
    identityId: CallIdentityId,
    missedAt: Timestamp,
  ): void {
    this.participant(identityId).markMissed(missedAt);
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: missedAt.valueOf(),
      type: 'CallParticipantMissed',
    } satisfies CallParticipantMissed);
  }

  public toPrimitives() {
    const participants = this.participants.map((participant) =>
      participant.toPrimitives(),
    );

    const primitives = {
      ...this.lifecycle.toPrimitives(),
      creatorIdentityId: this.creatorIdentityId.toString(),
      id: this.id.toString(),
      networkId: this.networkId.toString(),
      participantIds: participants.map((participant) => participant.identityId),
      participants,
      scope: this.scope.toPrimitives(),
    };

    return primitives;
  }
}
