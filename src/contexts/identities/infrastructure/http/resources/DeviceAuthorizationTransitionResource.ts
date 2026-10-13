import type { DeviceAuthorizationUnsignedPayload } from '../../../domain/DeviceAuthorizationUnsignedPayload';

export type DeviceAuthorizationTransitionResource =
  DeviceAuthorizationUnsignedPayload & {
    proofOfPossession?: string;
    signature: string;
  };
