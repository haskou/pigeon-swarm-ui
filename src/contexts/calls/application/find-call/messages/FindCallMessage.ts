import { CallId } from '../../../domain/value-objects/CallId';
import { CallIdentityId } from '../../../domain/value-objects/CallIdentityId';

export class FindCallMessage {
  public constructor(
    private readonly callId: string,
    private readonly actorIdentityId: string,
  ) {}

  public getActorIdentityId(): CallIdentityId {
    return CallIdentityId.fromString(this.actorIdentityId);
  }

  public getCallId(): CallId {
    return CallId.fromString(this.callId);
  }
}
