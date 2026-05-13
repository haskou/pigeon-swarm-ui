import type { IdentityResource } from '../types';

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

export type CallParticipant = {
  identity?: IdentityResource;
  identityId: string;
  muted: boolean;
  name: string;
  picture?: null | string;
  speaking?: boolean;
  status?: CallParticipantStatus;
};

export type CallSession = {
  call?: CallResource;
  id: string;
  communityId?: string;
  channelId?: string;
  conversationId?: string;
  kind: CallKind;
  muted: boolean;
  deafened: boolean;
  participants: CallParticipant[];
  startedAt: number;
  status:
    | 'connecting'
    | 'ended'
    | 'failed'
    | 'incoming'
    | 'live'
    | 'missed'
    | 'permission-denied';
  title: string;
};
