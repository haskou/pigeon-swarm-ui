import {
  deriveInviteReference,
  deriveInviteToken,
} from '../../../../../contexts/communities/infrastructure/http/deriveCommunityRecordId';
import vectors from '../../../../fixtures/community-operation-vectors.json';

// The fixture is the node's tests/fixtures/community-operation-vectors.json,
// checked there by CommunityInviteToken.
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
    expect(deriveInviteReference(invite.token)).toBe(invite.reference);
  });
});
