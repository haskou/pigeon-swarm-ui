import { IdentityId } from '../../../domain/value-objects/IdentityId';

export class RefreshIdentityMessage {
  public constructor(private readonly identityId: string) {}

  public getIdentityId(): IdentityId {
    return IdentityId.fromString(this.identityId);
  }
}
