import type { LeaveCommunityPort } from '../../../../../contexts/communities/application/leave-community/LeaveCommunityPort';
import type { CommunityKeychainPort } from '../../../../../contexts/communities/application/publish-community-keychain/CommunityKeychainPort';
import type {
  Community,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { LeaveCommunity } from '../../../../../contexts/communities/application/leave-community/LeaveCommunity';
import { LeaveCommunityMessage } from '../../../../../contexts/communities/application/leave-community/messages/LeaveCommunityMessage';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

function session(): Session {
  return {
    identity: { id: 'identity-1' },
    keychain: { conversations: { 'community-1': {} }, version: 1 },
  } as unknown as Session;
}

function community(): Community {
  return {
    createdAt: 1,
    description: 'Community',
    id: 'community-1',
    memberIds: [],
    name: 'Community',
    networkId: 'network-1',
    ownerIdentityId: 'identity-1',
    textChannels: [],
    visibility: 'private',
  };
}

describe(LeaveCommunity.name, () => {
  function useCase(): {
    leave: LeaveCommunity;
    membership: jest.Mocked<LeaveCommunityPort>;
    keychain: jest.Mocked<CommunityKeychainPort>;
  } {
    const membership = {
      leaveCommunity: jest.fn(),
    } as jest.Mocked<LeaveCommunityPort>;
    const keychain = {
      publishKeychain: jest.fn().mockImplementation((_session, value) => ({
        keychain: value,
        keychainExternalIdentifier: 'keychain-2',
      })),
    } as jest.Mocked<CommunityKeychainPort>;

    return {
      keychain,
      leave: new LeaveCommunity(membership, keychain),
      membership,
    };
  }

  it('removes the community key after leaving', async () => {
    const test = useCase();
    test.membership.leaveCommunity.mockResolvedValue(community());

    const result = await test.leave.leave(
      new LeaveCommunityMessage(session(), 'community-1'),
    );

    expect(test.keychain.publishKeychain).toHaveBeenCalledWith(session(), {
      conversations: {},
      version: 1,
    });
    expect(result.community).toEqual(community());
  });

  it('reconciles the keychain when the server already applied the leave', async () => {
    const test = useCase();
    test.membership.leaveCommunity.mockRejectedValue(
      new HttpJsonError(
        409,
        'Conflict',
        JSON.stringify({ code: 'CommunityMemberNotFoundError' }),
      ),
    );

    const result = await test.leave.leave(
      new LeaveCommunityMessage(session(), 'community-1'),
    );

    expect(test.keychain.publishKeychain).toHaveBeenCalledTimes(1);
    expect(result.community).toBeNull();
  });
});
