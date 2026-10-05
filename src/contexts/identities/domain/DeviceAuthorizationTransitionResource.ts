import type { DeviceAuthorizationUnsignedPayload } from './DeviceAuthorizationUnsignedPayload';

export type DeviceAuthorizationTransitionResource =
  DeviceAuthorizationUnsignedPayload & {
    proofOfPossession?: string;
    signature: string;
  };
