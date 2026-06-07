import type { CommunityChannel } from './CommunityChannel';
import type { CommunityMemberRolesResource } from './CommunityMemberRolesResource';
import type { CommunityRoleResource } from './CommunityRoleResource';
import type { CommunityTextChannel } from './CommunityTextChannel';
import type { CommunityVisibility } from './CommunityVisibility';
import type { CommunityVoiceChannel } from './CommunityVoiceChannel';

export type Community = {
  autoJoinEnabled?: boolean;
  avatar?: string | null;
  bannedMemberIds?: string[];
  banner?: string | null;
  channels?: CommunityChannel[];
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
  textChannels: CommunityTextChannel[];
  visibility: CommunityVisibility;
  voiceChannels?: CommunityVoiceChannel[];
};
