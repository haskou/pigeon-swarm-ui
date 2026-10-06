export type CommunityInvitationPayloadResource = {
  communityId: string;
  encryptedCommunityKey: string;
  inviterIdentityId: string;
  nonce: string;
  recipientIdentityId: string;
};
