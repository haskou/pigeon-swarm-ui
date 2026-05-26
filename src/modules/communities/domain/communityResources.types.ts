export type CommunityInvitationPayload = {
  communityId: string;
  encryptedCommunityKey: string;
  inviterIdentityId: string;
  inviterSignature: string;
  recipientIdentityId: string;
};

export type CommunityInviteLinkResource = {
  communityAvatar?: string | null;
  communityBanner?: string | null;
  communityId?: string;
  communityName?: string;
  encryptedCommunityKey?: {
    algorithm: 'AES-GCM';
    ciphertext: string;
    nonce: string;
    version: 1;
  };
  expiresAt?: number | null;
  inviteToken?: string;
  maxUses?: number;
  status?: string;
  token?: string;
  uses?: number;
};

export type CommunityVisibility = 'private' | 'public';

export type CommunityChannelPermissions = {
  visibleRoleIds: string[];
};

export type CommunityTextChannel = {
  createdAt: number;
  id: string;
  name: string;
  permissions?: CommunityChannelPermissions;
  type: 'text';
};

export type CommunityVoiceChannel = {
  connectedIdentityIds?: string[];
  createdAt: number;
  id: string;
  name: string;
  permissions?: CommunityChannelPermissions;
  type: 'voice';
};

export type CommunityChannel = CommunityTextChannel | CommunityVoiceChannel;

export type CommunityPermission =
  | 'approve_members'
  | 'attach_files'
  | 'ban_members'
  | 'connect_voice'
  | 'create_invites'
  | 'create_polls'
  | 'embed_links'
  | 'manage_channels'
  | 'manage_members'
  | 'manage_messages'
  | 'manage_roles'
  | 'mention_everyone'
  | 'mention_here'
  | 'mention_roles'
  | 'reject_members'
  | 'send_messages'
  | 'send_stickers'
  | 'view_channels';

export type CommunityRoleResource = {
  builtIn?: boolean;
  id: string;
  name: string;
  permissions: CommunityPermission[];
};

export type CommunityMemberRolesResource = {
  identityId: string;
  roleIds: string[];
};

export type Community = {
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

export type CommunityModerationAction =
  | 'channel_created'
  | 'channel_deleted'
  | 'channel_permissions_updated'
  | 'channel_renamed'
  | 'community_updated'
  | 'invitation_created'
  | 'invite_link_created'
  | 'member_banned'
  | 'member_roles_updated'
  | 'member_unbanned'
  | 'membership_request_accepted'
  | 'membership_request_declined'
  | 'message_deleted'
  | 'role_created'
  | 'role_deleted'
  | 'role_updated';

export type CommunityModerationTargetType =
  | 'channel'
  | 'community'
  | 'invite'
  | 'member'
  | 'membership_request'
  | 'message'
  | 'role';

export type CommunityModerationLog = {
  action: CommunityModerationAction;
  actorIdentityId: string;
  communityId: string;
  createdAt: number;
  details?: Record<string, unknown>;
  id: string;
  target: {
    id: string;
    type: CommunityModerationTargetType;
  };
};

export type CommunityModerationLogPage = {
  logs: CommunityModerationLog[];
  nextBeforeLogId?: string;
};

export type CommunityMessageMention =
  | { type: 'everyone' }
  | { type: 'here' }
  | { targetId: string; type: 'identity' }
  | { targetId: string; type: 'role' };

export type CommunityMembershipRequestStatus =
  | 'accepted'
  | 'declined'
  | 'pending';

export type CommunityMembershipRequestType = 'invitation' | 'request';

export type CommunityMembershipRequest = {
  communityId: string;
  createdAt: number | string;
  creatorIdentityId: string;
  id: string;
  identityId: string;
  status: CommunityMembershipRequestStatus;
  type: CommunityMembershipRequestType;
  updatedAt: number | string;
};

export type CommunityDiscoveryResource = {
  avatar?: string | null;
  banner?: string | null;
  description: string;
  discoverable?: boolean;
  id: string;
  memberCount: number;
  membershipRequest?: CommunityMembershipRequest;
  membershipStatus: 'invited' | 'member' | 'none' | 'requested';
  name: string;
  networkId: string;
  ownerIdentityId: string;
  visibility: CommunityVisibility;
};
