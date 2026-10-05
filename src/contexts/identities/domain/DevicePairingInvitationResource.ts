import type { DevicePairingInvitationPayload } from './DevicePairingInvitationPayload';

export type DevicePairingInvitationResource = DevicePairingInvitationPayload & {
  kind: 'pigeon-device-pairing-invitation';
  signature: string;
};
