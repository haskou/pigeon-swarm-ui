import { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { CommunityOperationSigner } from '../../../../../contexts/communities/infrastructure/http/CommunityOperationSigner';
import { deriveCommunityId } from '../../../../../contexts/communities/infrastructure/http/deriveCommunityRecordId';

// Vectors produced with the node's CommunityId.derive and
// CommunityOperation.create formulas (canonicalize + sha256 base64url).
const owner = 'ownerIdentityAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const communityId = '5lUXgi6OhVKdOBRMTnz50S2gdshPj6GeB34kbG_x3nM';
const genesisHash = 'u_agkN6mHtFQwAumeTiKE0GbXoeOyPba_7lSWMj25M0';

async function sessionOf(identityId: string): Promise<Session> {
  return {
    deviceCredentialKeyPair: await KeyPair.generate(),
    identity: { id: identityId },
  } as unknown as Session;
}

describe(CommunityOperationSigner.name, () => {
  const signer = new CommunityOperationSigner();

  it('derives the community id like the node', () => {
    expect(deriveCommunityId('network-1', owner, 'nonce-vector-1')).toBe(
      communityId,
    );
  });

  it('signs the genesis with the node record id and payload digest', async () => {
    const operation = signer.sign(await sessionOf(owner), {
      action: 'community_created',
      args: {
        autoJoinEnabled: false,
        description: 'About',
        discoverable: true,
        name: 'Vector',
        nonce: 'nonce-vector-1',
        visibility: 'private',
      },
      communityId,
      createdAt: 1700000000000,
      networkId: 'network-1',
      parents: [],
    });

    expect(operation.parents).toEqual([]);
    expect(operation.mutation).toMatchObject({
      kind: 'put',
      payloadDigest: 'uiHpDiq5NXyymyUsve33lYpWzPat4Bb9ul2s3c6nZjY',
      predecessor: null,
      recordId: `community:${communityId}:op:${genesisHash}`,
      sequence: 0,
      store: 'communityOperations',
    });
  });

  it('signs a member_joined on the genesis frontier like the node', async () => {
    const operation = signer.sign(await sessionOf('joinerIdentity'), {
      action: 'member_joined',
      args: {
        identityId: 'joinerIdentity',
        method: 'invite_link',
        reference: 'token-1',
      },
      communityId,
      createdAt: 1700000001000,
      networkId: 'network-1',
      parents: [genesisHash],
    });

    expect(operation.parents).toEqual([genesisHash]);
    expect(operation.mutation).toMatchObject({
      payloadDigest: 'AUmBCbG9PM02yzyMZUCGg6CKHh7fLnornUVBIxkMm6Y',
      recordId: `community:${communityId}:op:inTqUkAKUKjkHPP_d8JvArw7uc4oxmB0aa-UPz9rwgY`,
    });
  });

  it('sorts parents ascending as the node requires', async () => {
    const operation = signer.sign(await sessionOf(owner), {
      action: 'member_banned',
      args: { identityId: 'x' },
      communityId,
      createdAt: 1,
      networkId: 'network-1',
      parents: ['b'.repeat(43), 'a'.repeat(43)],
    });

    expect(operation.parents).toEqual(['a'.repeat(43), 'b'.repeat(43)]);
  });
});
