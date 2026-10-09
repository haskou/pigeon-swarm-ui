export type CommunityInvitationPayloadResource = {
  communityId: string;
  inviterIdentityId: string;
  nonce: string;
  recipientIdentityId: string;
};
