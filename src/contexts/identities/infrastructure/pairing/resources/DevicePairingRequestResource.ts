import type { DevicePairingRequestPayload } from '../../../domain/DevicePairingRequestPayload';

export type DevicePairingRequestResource = DevicePairingRequestPayload & {
  kind: 'pigeon-device-pairing-request';
  signature: string;
};
