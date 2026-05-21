export type CommunityInvitationPayload = {
  communityId: string;
  encryptedCommunityKey: string;
  inviterIdentityId: string;
  inviterSignature: string;
  recipientIdentityId: string;
};

export type CommunityInviteLinkResource = {
  communityId?: string;
  expiresAt?: string | null;
  inviteToken?: string;
  maxUses?: number;
  token?: string;
};

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
  visibility: 'private';
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
  visibility: 'private';
};
