import { CallId } from '../../../domain/value-objects/CallId';
import { CallIdentityId } from '../../../domain/value-objects/CallIdentityId';
import { CallSignal } from '../../../domain/value-objects/CallSignal';

export class SendCallSignalMessage {
  public constructor(
    private readonly primitives: {
      actorIdentityId: string;
      callId: string;
      payload: Record<string, unknown>;
      recipientIdentityId: string;
      signalType: 'answer' | 'ice_candidate' | 'offer';
    },
  ) {}

  public getActorIdentityId(): CallIdentityId {
    return CallIdentityId.fromString(this.primitives.actorIdentityId);
  }

  public getCallId(): CallId {
    return CallId.fromString(this.primitives.callId);
  }

  public getSignal(): CallSignal {
    return CallSignal.fromPrimitives({
      payload: this.primitives.payload,
      recipientIdentityId: this.primitives.recipientIdentityId,
      signalType: this.primitives.signalType,
    });
  }
}
