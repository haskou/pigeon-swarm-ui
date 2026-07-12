import type {
  Community,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonCommunityInvitationApi } from '../../../../../contexts/communities/infrastructure/http/PigeonCommunityInvitationApi';

describe(PigeonCommunityInvitationApi.name, () => {
  it('invites into a public community without publishing a key', async () => {
    const community = { visibility: 'public' } as Community;
    const get = jest.fn().mockResolvedValue(community);
    const inviteMember = jest.fn();
    const session = {
      identity: { id: 'identity-1' },
      keychain: { conversations: {}, version: 1 },
    } as unknown as Session;
    const api = new PigeonCommunityInvitationApi(
      {} as HttpJsonClient,
      {} as RequestSigner,
      { get, inviteMember },
      {} as never,
      {} as never,
    );

    await expect(
      api.create(session, 'community-1', ' identity-2 '),
    ).resolves.toEqual({
      keychain: session.keychain,
      keychainExternalIdentifier: null,
    });
    expect(get).toHaveBeenCalledWith(session, 'community-1');
    expect(inviteMember).toHaveBeenCalledWith(
      session,
      'community-1',
      'identity-2',
    );
  });
});
