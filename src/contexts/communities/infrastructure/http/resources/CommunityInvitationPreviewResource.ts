/** What a link holder may see of a community before joining it. */
export interface CommunityInvitationPreviewResource {
  communityAvatar?: string;
  communityBanner?: string;
  communityId: string;
  communityName: string;
  expiresAt: number;
  invitationId: string;
  networkId: string;
}
