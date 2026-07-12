import type { PigeonCommunitiesApi } from '../../../../../contexts/communities/infrastructure/http/PigeonCommunitiesApi';
import type { PigeonCommunityInvitationApi } from '../../../../../contexts/communities/infrastructure/http/PigeonCommunityInvitationApi';
import type {
  Community,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { PigeonCommunitiesGateway } from '../../../../../contexts/communities/infrastructure/http/PigeonCommunitiesGateway';
import { RequestCache } from '../../../../../shared/infrastructure/http/RequestCache';

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

function session(): Session {
  return {
    identity: { id: 'identity-1' },
    keychain: { conversations: {}, version: 1 },
  } as unknown as Session;
}

function gatewayDouble(): {
  communities: jest.Mocked<
    Pick<PigeonCommunitiesApi, 'createJoinRequest' | 'get' | 'list'>
  >;
  gateway: PigeonCommunitiesGateway;
  invitations: jest.Mocked<Pick<PigeonCommunityInvitationApi, 'notifyMember'>>;
  requestCache: jest.Mocked<Pick<RequestCache, 'invalidateForSession'>>;
} {
  const communities = {
    createJoinRequest: jest.fn(),
    get: jest.fn(),
    list: jest.fn(),
  } as jest.Mocked<
    Pick<PigeonCommunitiesApi, 'createJoinRequest' | 'get' | 'list'>
  >;
  const invitations = {
    notifyMember: jest.fn(),
  } as jest.Mocked<Pick<PigeonCommunityInvitationApi, 'notifyMember'>>;
  const requestCache = {
    invalidateForSession: jest.fn(),
  } as jest.Mocked<Pick<RequestCache, 'invalidateForSession'>>;
  const media = {
    uploadPublicFile: jest.fn(),
  };

  return {
    communities,
    gateway: new PigeonCommunitiesGateway(
      communities as unknown as PigeonCommunitiesApi,
      invitations as unknown as PigeonCommunityInvitationApi,
      requestCache as unknown as RequestCache,
      media,
    ),
    invitations,
    requestCache,
  };
}

describe(PigeonCommunitiesGateway.name, () => {
  it('adapts community listing to the application-facing name', async () => {
    const { communities, gateway } = gatewayDouble();
    const result = [community()];
    communities.list.mockResolvedValue(result);

    await expect(gateway.listCommunities(session())).resolves.toBe(result);
    expect(communities.list).toHaveBeenCalledWith(session());
  });

  it('invalidates membership-request reads after creating a request', async () => {
    const { communities, gateway, requestCache } = gatewayDouble();
    const request = {
      communityId: 'community-1',
      createdAt: 1,
      creatorIdentityId: 'identity-2',
      id: 'request-1',
      identityId: 'identity-2',
      status: 'pending',
      type: 'request',
      updatedAt: 1,
    } as const;
    communities.createJoinRequest.mockResolvedValue(request);

    await gateway.createCommunityJoinRequest(session(), 'community-1');

    expect(requestCache.invalidateForSession).toHaveBeenCalledWith(
      '/communities/membership-requests',
      session(),
    );
  });
});
