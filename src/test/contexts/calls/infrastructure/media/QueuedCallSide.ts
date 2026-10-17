import type { CallPeerConnections } from '../../../../../contexts/calls/infrastructure/media/CallPeerConnections';
import type { CallSignalType } from '../../../../../contexts/calls/infrastructure/media/CallSignalType';
import type { SignalSender } from '../../../../../contexts/calls/infrastructure/media/descriptionPayload';

/**
 * One identity of a call: what it signals queues in `outbox` until
 * `deliverTo` hands it to the identity it is meant for, so a test decides
 * which signals cross.
 */
export class QueuedCallSide {
  public readonly outbox: Array<[CallSignalType, Record<string, unknown>]> = [];

  public constructor(
    public readonly identityId: string,
    public readonly manager: CallPeerConnections,
  ) {}

  public readonly sendSignal: SignalSender = (
    _recipientIdentityId,
    signalType,
    payload,
  ) => {
    this.outbox.push([signalType, payload]);

    return Promise.resolve();
  };

  /** Hands `other` what this side sent since the last delivery. */
  public async deliverTo(other: QueuedCallSide): Promise<void> {
    for (const [signalType, payload] of this.outbox.splice(0)) {
      await other.manager.handleSignal(
        this.identityId,
        signalType,
        payload,
        other.sendSignal,
        other.identityId,
      );
    }
  }
}
