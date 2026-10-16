import { CommunityInviteReference } from '@haskou/pigeon-swarm-crypto';
import vectors from '@haskou/pigeon-swarm-crypto/vectors/community-operation.json';

import { deriveInviteToken } from '../../../../../contexts/communities/infrastructure/http/deriveCommunityRecordId';

// The library ships these vectors; the node checks them through
// CommunityInviteToken.
describe('invite token vectors', () => {
  const invite = vectors.inviteToken;

  it('derives the node token, which commits to the invite limits', () => {
    expect(
      deriveInviteToken(
        invite.communityId,
        invite.creatorIdentityId,
        invite.nonce,
        invite.maxUses,
        invite.expiresAt,
      ),
    ).toBe(invite.token);
  });

  it('derives a different token for other limits', () => {
    expect(
      deriveInviteToken(
        invite.communityId,
        invite.creatorIdentityId,
        invite.nonce,
        invite.maxUses + 1,
        undefined,
      ),
    ).not.toBe(invite.token);
  });

  it('derives the node reference of the token', () => {
    expect(CommunityInviteReference.of(invite.token)).toBe(invite.reference);
  });
});
