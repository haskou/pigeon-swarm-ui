import type { DevicePairingInvitationPayload } from '../../../domain/DevicePairingInvitationPayload';

export type DevicePairingInvitationResource = DevicePairingInvitationPayload & {
  kind: 'pigeon-device-pairing-invitation';
  signature: string;
};
