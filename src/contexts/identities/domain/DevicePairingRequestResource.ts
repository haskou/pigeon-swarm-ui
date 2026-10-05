import type { DevicePairingRequestPayload } from './DevicePairingRequestPayload';

export type DevicePairingRequestResource = DevicePairingRequestPayload & {
  kind: 'pigeon-device-pairing-request';
  signature: string;
};
