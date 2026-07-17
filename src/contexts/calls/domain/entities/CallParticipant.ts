import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { CallIdentityId } from '../value-objects/CallIdentityId';
import { CallParticipantConnectionStatus } from '../value-objects/CallParticipantConnectionStatus';
import { CallParticipantStatus } from '../value-objects/CallParticipantStatus';
import { CallParticipantTimeline } from '../value-objects/CallParticipantTimeline';
import { CallMediaConnection } from './CallMediaConnection';

export class CallParticipant {
  public static fromPrimitives(
    primitives: PrimitiveOf<CallParticipant>,
  ): CallParticipant {
    return new CallParticipant(
      CallIdentityId.fromString(primitives.identityId),
      CallParticipantStatus.fromPrimitives(primitives.status),
      primitives.connected
        ? CallParticipantConnectionStatus.CONNECTED
        : CallParticipantConnectionStatus.DISCONNECTED,
      primitives.mediaConnections.map((connection) =>
        CallMediaConnection.fromPrimitives(connection),
      ),
      CallParticipantTimeline.fromPrimitives(primitives),
    );
  }

  private constructor(
    private readonly identityId: CallIdentityId,
    private status: CallParticipantStatus,
    private connectionStatus: CallParticipantConnectionStatus,
    private mediaConnections: CallMediaConnection[],
    private timeline: CallParticipantTimeline,
  ) {}

  public belongsTo(identityId: CallIdentityId): boolean {
    return this.identityId.isEqual(identityId);
  }

  public hasStatus(status: CallParticipantStatus): boolean {
    return this.status.isEqual(status);
  }

  public join(at: Timestamp): void {
    this.status = CallParticipantStatus.JOINED;
    this.timeline = this.timeline.join(at);
  }

  public leave(at: Timestamp): void {
    this.status = CallParticipantStatus.LEFT;
    this.connectionStatus = CallParticipantConnectionStatus.DISCONNECTED;
    this.timeline = this.timeline.leave(at);
  }

  public markMissed(at: Timestamp): void {
    this.status = CallParticipantStatus.MISSED;
    this.connectionStatus = CallParticipantConnectionStatus.DISCONNECTED;
    this.timeline = this.timeline.markMissed(at);
  }

  public heartbeat(at: Timestamp): void {
    this.connectionStatus = CallParticipantConnectionStatus.CONNECTED;
    this.timeline = this.timeline.heartbeat(at);
  }

  public updateMediaConnections(mediaConnections: CallMediaConnection[]): void {
    this.mediaConnections = [...mediaConnections];
  }

  public toPrimitives() {
    const primitives = {
      ...this.timeline.toPrimitives(),
      connected: this.connectionStatus.isConnected(),
      identityId: this.identityId.toString(),
      mediaConnections: this.mediaConnections.map((connection) =>
        connection.toPrimitives(),
      ),
      status: this.status.valueOf(),
    };

    return primitives;
  }
}
