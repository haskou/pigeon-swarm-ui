export const IDENTITY_PROFILE_BIOGRAPHY_MAX_LENGTH = 100;
export const IDENTITY_PROFILE_HANDLE_MAX_LENGTH = 32;
export const IDENTITY_PROFILE_HANDLE_MIN_LENGTH = 3;
export const IDENTITY_PROFILE_NAME_MAX_LENGTH = 20;

const identityProfileHandlePattern = /^[a-z0-9._-]+$/;

export function isIdentityProfileHandleValueValid(value: string): boolean {
  return (
    value.length >= IDENTITY_PROFILE_HANDLE_MIN_LENGTH &&
    value.length <= IDENTITY_PROFILE_HANDLE_MAX_LENGTH &&
    identityProfileHandlePattern.test(value)
  );
}
