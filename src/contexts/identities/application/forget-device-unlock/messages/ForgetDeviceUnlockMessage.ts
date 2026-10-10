import { IdentityId } from '../../../domain/value-objects/IdentityId';

export class ForgetDeviceUnlockMessage {
  public constructor(private readonly identityId: string) {}

  public getIdentityId(): IdentityId {
    return IdentityId.fromString(this.identityId);
  }
}
