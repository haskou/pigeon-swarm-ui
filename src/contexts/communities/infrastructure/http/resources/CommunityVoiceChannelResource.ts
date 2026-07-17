import type { CommunityChannelPermissionsResource } from './CommunityChannelPermissionsResource';

export type CommunityVoiceChannelResource = {
  connectedIdentityIds?: string[];
  createdAt: number;
  id: string;
  name: string;
  permissions?: CommunityChannelPermissionsResource;
  type: 'voice';
};
