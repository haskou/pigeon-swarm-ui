import { IdentityId } from '../../../domain/value-objects/IdentityId';

export class SearchPresenceSharingsMessage {
  public constructor(private readonly actorIdentityId: string) {}

  public getActorIdentityId(): IdentityId {
    return IdentityId.fromString(this.actorIdentityId);
  }
}
