export interface CommunityModerationLogInput {
  action:
    | 'channel_created'
    | 'channel_deleted'
    | 'channel_permissions_updated'
    | 'channel_renamed'
    | 'community_updated'
    | 'invitation_created'
    | 'invite_link_created'
    | 'member_banned'
    | 'member_kicked'
    | 'member_roles_updated'
    | 'member_unbanned'
    | 'membership_request_accepted'
    | 'membership_request_declined'
    | 'message_deleted'
    | 'role_created'
    | 'role_deleted'
    | 'role_updated';
  communityId: string;
  createdAt: number;
  details: Record<string, unknown>;
  target: {
    id: string;
    type:
      | 'channel'
      | 'community'
      | 'invite'
      | 'member'
      | 'membership_request'
      | 'message'
      | 'role';
  };
}
