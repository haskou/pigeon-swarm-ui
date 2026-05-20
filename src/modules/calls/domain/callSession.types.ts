import type { IdentityResource } from '../../../shared/domain/pigeonResources.types';

export type CallKind = 'community-voice' | 'group' | 'one-to-one';

export type CallParticipantStatus =
  | 'declined'
  | 'joined'
  | 'left'
  | 'missed'
  | 'ringing';

export type CallResourceParticipant = {
  declinedAt?: number;
  identityId: string;
  joinedAt?: number;
  leftAt?: number;
  missedAt?: number;
  status: CallParticipantStatus;
};

export type CallScope =
  | {
      conversationId: string;
      type: 'conversation';
    }
  | {
      channelId: string;
      communityId: string;
      type: 'community_channel';
    };

export type CallResource = {
  createdAt: number;
  creatorIdentityId: string;
  endedAt?: number;
  id: string;
  networkId: string;
  participantIds: string[];
  participants: CallResourceParticipant[];
  scope: CallScope;
  status: 'active' | 'ended' | 'missed';
};

export type CallSignalType = 'answer' | 'ice_candidate' | 'offer';

export type CallSignalPayload = {
  payload: Record<string, unknown>;
  recipientIdentityId: string;
  signalType: CallSignalType;
};

export type CallIceServerConfig = {
  iceServers: RTCIceServer[];
  iceTransportPolicy?: RTCIceTransportPolicy;
};

export type CallParticipant = {
  audioLevel?: number;
  connectionState?: RTCPeerConnectionState;
  deafened?: boolean;
  identity?: IdentityResource;
  identityId: string;
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
  videoEnabled?: boolean;
};

export type CallSession = {
  call?: CallResource;
  id: string;
  currentIdentityId: string;
  communityId?: string;
  channelId?: string;
  conversationId?: string;
  kind: CallKind;
  muted: boolean;
  hasMicrophone: boolean;
  cameraEnabled: boolean;
  deafened: boolean;
  localPreviewStream?: MediaStream;
  participants: CallParticipant[];
  participantVolumes: Record<string, number>;
  screenSharing: boolean;
  startedAt: number;
  status:
    | 'connecting'
    | 'ended'
    | 'failed'
    | 'incoming'
    | 'live'
    | 'missed'
    | 'permission-denied';
  subtitle?: string;
  title: string;
};
