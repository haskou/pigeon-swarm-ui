import type { IdentityResource } from '../types';

export type CallKind = 'community-voice' | 'group' | 'one-to-one';

export type CallParticipant = {
  identity?: IdentityResource;
  identityId: string;
  muted: boolean;
  name: string;
  picture?: null | string;
  speaking?: boolean;
};

export type CallSession = {
  id: string;
  communityId?: string;
  channelId?: string;
  conversationId?: string;
  kind: CallKind;
  muted: boolean;
  deafened: boolean;
  participants: CallParticipant[];
  startedAt: number;
  status: 'connecting' | 'live' | 'permission-denied' | 'failed';
  title: string;
};
