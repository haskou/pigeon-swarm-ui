import type { DevicePairingCompletionPayload } from '../../../domain/DevicePairingCompletionPayload';

export type DevicePairingCompletionResource = DevicePairingCompletionPayload & {
  kind: 'pigeon-device-pairing-completion';
  signature: string;
};
