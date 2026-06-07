import type { IdentityResource } from '../../../shared/domain/pigeonResources.types';
import type { CallParticipantStatus } from './CallParticipantStatus';

export type CallParticipant = {
  audioLevel?: number;
  bitrateKbps?: number;
  codec?: string;
  connectionPath?: 'direct' | 'relay' | 'unknown';
  connectionState?: RTCPeerConnectionState;
  deafened?: boolean;
  identity?: IdentityResource;
  identityId: string;
  iceState?: RTCIceConnectionState;
  jitterMs?: number;
  latencyMs?: number;
  mediaStream?: MediaStream;
  muted: boolean;
  name: string;
  packetsLost?: number;
  picture?: null | string;
  screenStream?: MediaStream;
  screenSharing?: boolean;
  speaking?: boolean;
  status?: CallParticipantStatus;
  transport?: string;
  videoEnabled?: boolean;
};
