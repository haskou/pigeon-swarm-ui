import { IdentityId } from '../../../domain/value-objects/IdentityId';

export class FindIdentityPresenceMessage {
  public constructor(
    private readonly identityId: string,
    private readonly actorIdentityId: string,
  ) {}

  public getActorIdentityId(): IdentityId {
    return IdentityId.fromString(this.actorIdentityId);
  }

  public getIdentityId(): IdentityId {
    return IdentityId.fromString(this.identityId);
  }
}
