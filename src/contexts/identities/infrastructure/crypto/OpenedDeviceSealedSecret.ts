import type { DeviceCredential } from '../../domain/value-objects/DeviceCredential';

/**
 * An opened secret and the device whose signature over it verified. That
 * signature proves only who published it; whether the signed transitions
 * authorize that device is for the caller to check.
 */
export type OpenedDeviceSealedSecret = {
  authorizationRevision: number;
  generation: number;
  payload: string;
  publisherCredential: DeviceCredential;
};
