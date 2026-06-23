import type { LocalDeviceUnlockKeyPair } from './LocalDeviceUnlockKeyPair';

export type LocalDeviceUnlockPayload = {
  keyPair: LocalDeviceUnlockKeyPair;
  masterKey: string;
  version: 1;
};
