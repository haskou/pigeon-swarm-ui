import { CallIdentityId } from '../../../domain/value-objects/CallIdentityId';

export class SearchCallsMessage {
  public constructor(private readonly actorIdentityId: string) {}

  public getActorIdentityId(): CallIdentityId {
    return CallIdentityId.fromString(this.actorIdentityId);
  }
}
