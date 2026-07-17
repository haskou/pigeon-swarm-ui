import type { CommunityChannelResource } from './CommunityChannelResource';
import type { CommunityMemberRolesResource } from './CommunityMemberRolesResource';
import type { CommunityRoleResource } from './CommunityRoleResource';
import type { CommunityTextChannelResource } from './CommunityTextChannelResource';
import type { CommunityVisibilityResource } from './CommunityVisibilityResource';
import type { CommunityVoiceChannelResource } from './CommunityVoiceChannelResource';

export type CommunityResource = {
  autoJoinEnabled?: boolean;
  avatar?: string | null;
  bannedMemberIds?: string[];
  banner?: string | null;
  channels?: CommunityChannelResource[];
  createdAt: number;
  description: string;
  discoverable?: boolean;
  id: string;
  memberIds: string[];
  memberRoles?: CommunityMemberRolesResource[];
  name: string;
  networkId: string;
  ownerIdentityId: string;
  roles?: CommunityRoleResource[];
  textChannels: CommunityTextChannelResource[];
  visibility: CommunityVisibilityResource;
  voiceChannels?: CommunityVoiceChannelResource[];
};
