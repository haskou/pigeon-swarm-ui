import type { DeviceCredential } from '../../domain/value-objects/DeviceCredential';

export type DeviceSealedSecretPublication = {
  generation: number;
  payload: string;
  recipients: readonly DeviceCredential[];
};
