import type { DeviceAuthorizationUnsignedPayload } from './DeviceAuthorizationUnsignedPayload';

export type DeviceAuthorizationTransitionPrimitives =
  DeviceAuthorizationUnsignedPayload & {
    proofOfPossession?: string;
    signature: string;
  };
