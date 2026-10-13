import { IdentityId } from '../../../domain/value-objects/IdentityId';

export class ForgetCurrentDeviceMessage {
  public constructor(
    private readonly identityId: string,
    private readonly allowOnlyDevice: boolean,
  ) {}

  public getAllowOnlyDevice(): boolean {
    return this.allowOnlyDevice;
  }

  public getIdentityId(): IdentityId {
    return IdentityId.fromString(this.identityId);
  }
}
