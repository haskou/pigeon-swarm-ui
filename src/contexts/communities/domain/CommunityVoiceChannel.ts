import type { CommunityChannelPermissions } from './CommunityChannelPermissions';

export type CommunityVoiceChannel = {
  connectedIdentityIds?: string[];
  createdAt: number;
  id: string;
  name: string;
  permissions?: CommunityChannelPermissions;
  type: 'voice';
};
