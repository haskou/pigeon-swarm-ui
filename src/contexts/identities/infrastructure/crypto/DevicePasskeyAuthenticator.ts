import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { DevicePasskeyCredential } from './DevicePasskeyCredential';
import type { DevicePasskeyEnrollment } from './DevicePasskeyEnrollment';

/** Derives the local unlock secret from a user-verified passkey. */
export interface DevicePasskeyAuthenticator {
  evaluate(credential: DevicePasskeyCredential): Promise<string>;
  isSupported(): Promise<boolean>;
  register(input: {
    displayName: string;
    identityId: IdentityId;
  }): Promise<DevicePasskeyEnrollment>;
}
