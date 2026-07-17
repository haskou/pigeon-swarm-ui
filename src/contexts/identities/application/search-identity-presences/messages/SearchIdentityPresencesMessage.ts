import { IdentityId } from '../../../domain/value-objects/IdentityId';

export class SearchIdentityPresencesMessage {
  public constructor(
    private readonly identityIds: string[],
    private readonly actorIdentityId: string,
  ) {}

  public getActorIdentityId(): IdentityId {
    return IdentityId.fromString(this.actorIdentityId);
  }

  public getIdentityIds(): IdentityId[] {
    return this.identityIds.map(IdentityId.fromString);
  }
}
