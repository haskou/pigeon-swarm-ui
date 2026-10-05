import type { DevicePairingCompletionPayload } from './DevicePairingCompletionPayload';

export type DevicePairingCompletionResource = DevicePairingCompletionPayload & {
  kind: 'pigeon-device-pairing-completion';
  signature: string;
};
