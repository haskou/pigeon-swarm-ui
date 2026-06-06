import { assert, StringValueObject } from '@haskou/value-objects';

import {
  IDENTITY_PROFILE_HANDLE_MAX_LENGTH,
  IDENTITY_PROFILE_HANDLE_MIN_LENGTH,
  isIdentityProfileHandleValueValid,
} from './IdentityProfileConstraints';

export class ProfileHandle extends StringValueObject {
  public static readonly MAX_LENGTH = IDENTITY_PROFILE_HANDLE_MAX_LENGTH;
  public static readonly MIN_LENGTH = IDENTITY_PROFILE_HANDLE_MIN_LENGTH;

  private static normalize(value: string | StringValueObject): string {
    return value.valueOf().toLowerCase();
  }

  public static fromString(value: string | StringValueObject): ProfileHandle {
    return new ProfileHandle(value);
  }

  public constructor(value: string | StringValueObject) {
    super(ProfileHandle.normalize(value), ProfileHandle.MAX_LENGTH);

    assert(this.isValid(), Error('InvalidProfileHandleError'));
  }

  private isValid(): boolean {
    return isIdentityProfileHandleValueValid(this.value);
  }
}
