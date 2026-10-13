import type { DevicePasskeyCredential } from './DevicePasskeyCredential';

export type DevicePasskeyEnrollment = {
  credential: DevicePasskeyCredential;
  secret: string;
};
