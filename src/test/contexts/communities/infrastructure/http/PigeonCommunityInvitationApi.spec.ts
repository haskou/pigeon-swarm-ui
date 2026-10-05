import { KeyPair } from '@haskou/pigeon-swarm-crypto';

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

  it('signs invite links with the derived token as record id', async () => {
    const device = await KeyPair.generate();
    const http = {
      request: jest.fn().mockResolvedValue({ token: 'ignored' }),
    } as unknown as HttpJsonClient;
    const session = {
      deviceCredentialKeyPair: device,
      identity: { id: 'identity-1' },
      keychain: { conversations: {}, version: 1 },
    } as unknown as Session;
    const api = new PigeonCommunityInvitationApi(
      http,
      { headers: jest.fn().mockResolvedValue({}) } as unknown as RequestSigner,
      { get: jest.fn().mockResolvedValue({ visibility: 'public' }) } as never,
      {} as never,
      {} as never,
    );

    await api.createInviteLink(session, 'community-1', { maxUses: 3 });

    const body = JSON.parse(
      (
        (http.request as jest.Mock).mock.calls[0] as [string, { body: string }]
      )[1].body,
    ) as {
      mutation: { recordId: string; sequence: number; store: string };
      nonce: string;
    };

    expect(body.nonce).toHaveLength(32);
    expect(body.mutation).toMatchObject({
      recordId: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      sequence: 0,
      store: 'requests',
    });
  });

  it('signs invite acceptance as the acceptor use record', async () => {
    const device = await KeyPair.generate();
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce({ communityId: 'community-1', token: 'tok' })
        .mockResolvedValueOnce({ id: 'community-1' }),
    } as unknown as HttpJsonClient;
    const session = {
      deviceCredentialKeyPair: device,
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const api = new PigeonCommunityInvitationApi(
      http,
      { headers: jest.fn().mockResolvedValue({}) } as unknown as RequestSigner,
      {} as never,
      {} as never,
      {} as never,
    );

    await api.acceptInviteLink(session, 'tok');

    const body = JSON.parse(
      (
        (http.request as jest.Mock).mock.calls[1] as [string, { body: string }]
      )[1].body,
    ) as { mutation: Record<string, unknown>; usedAt: number };

    expect(body.usedAt).toEqual(expect.any(Number));
    expect(body.mutation).toMatchObject({
      kind: 'put',
      predecessor: null,
      recordId: expect.stringMatching(/^invite-use:tok:/),
      store: 'requests',
    });
  });
});
