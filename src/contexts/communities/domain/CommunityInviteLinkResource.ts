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
