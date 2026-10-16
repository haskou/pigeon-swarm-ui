import { CommunityInviteReference, KeyPair } from '@haskou/pigeon-swarm-crypto';
import vectors from '@haskou/pigeon-swarm-crypto/vectors/community-operation.json';

import type { CommunityResource as Community } from '../../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { CommunityModerationLogSigner } from '../../../../../contexts/communities/infrastructure/http/CommunityModerationLogSigner';
import { CommunityOperationProof } from '../../../../../contexts/communities/infrastructure/http/CommunityOperationProof';
import { deriveInviteToken } from '../../../../../contexts/communities/infrastructure/http/deriveCommunityRecordId';
import { PigeonCommunityInvitationApi } from '../../../../../contexts/communities/infrastructure/http/PigeonCommunityInvitationApi';
import { ScopeFrontierReader } from '../../../../../shared/infrastructure/http/ScopeFrontierReader';
import { publicMutationSignerAt } from '../../../../shared/infrastructure/crypto/publicMutationSignerAt';

beforeEach(() => {
  jest
    .spyOn(ScopeFrontierReader.prototype, 'community')
    .mockResolvedValue(['F'.repeat(43)]);
});

describe(PigeonCommunityInvitationApi.name, () => {
  it('invites into a public community without notifying', async () => {
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
      { frontier: jest.fn(), get, inviteMember },
      publicMutationSignerAt(),
    );

    await expect(
      api.create(session, 'community-1', ' identity-2 '),
    ).resolves.toBeUndefined();
    expect(get).toHaveBeenCalledWith(session, 'community-1');
    expect(inviteMember).toHaveBeenCalledWith(
      session,
      'community-1',
      'identity-2',
    );
  });

  it('notifies invitees of private communities without key material', async () => {
    const device = await KeyPair.generate();
    const request = jest.fn().mockResolvedValue({});
    const session = {
      deviceCredentialKeyPair: device,
      identity: { id: 'identity-1' },
      keychain: { conversations: {}, version: 1 },
    } as unknown as Session;
    const api = new PigeonCommunityInvitationApi(
      { request } as unknown as HttpJsonClient,
      { headers: jest.fn().mockResolvedValue({}) } as unknown as RequestSigner,
      {
        frontier: jest.fn(),
        get: jest.fn().mockResolvedValue({ visibility: 'private' }),
        inviteMember: jest.fn(),
      },
      publicMutationSignerAt(),
    );

    await api.create(session, 'community-1', 'identity-2');

    const sent = (request.mock.calls[0] as [string, { body: string }])[1].body;

    expect(sent).not.toMatch(/ncryptedCommunityKey|ncryptedKey/);
    expect(JSON.parse(sent)).toMatchObject({
      communityId: 'community-1',
      recipientIdentityId: 'identity-2',
      type: 'community_invitation',
    });
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
      publicMutationSignerAt(),
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
      recordId: deriveInviteToken(
        'community-1',
        publicMutationSignerAt().authorOf(session),
        body.nonce,
        3,
        undefined,
      ),
      sequence: 0,
      store: 'requests',
    });
  });

  it('logs a created invite link by its reference, never the token', async () => {
    const log = jest.spyOn(CommunityModerationLogSigner.prototype, 'sign');
    const request = jest
      .fn<Promise<unknown>, [string, { body: string }]>()
      .mockResolvedValue({});
    const http = { request } as unknown as HttpJsonClient;
    const session = {
      deviceCredentialKeyPair: await KeyPair.generate(),
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const api = new PigeonCommunityInvitationApi(
      http,
      { headers: jest.fn().mockResolvedValue({}) } as unknown as RequestSigner,
      {} as never,
      publicMutationSignerAt(),
    );

    await api.createInviteLink(session, 'community-1');

    const sent: { mutation: { recordId: string } } = JSON.parse(
      request.mock.calls[0]?.[1].body ?? '{}',
    );
    const token = sent.mutation.recordId;
    const reference = CommunityInviteReference.of(token);

    expect(log.mock.calls[0]?.[1].target).toEqual({
      id: reference,
      type: 'invite',
    });
    expect(JSON.stringify(log.mock.calls[0]?.[1])).not.toContain(token);
  });

  it('signs invite acceptance with the invite reference, never the token', async () => {
    const { reference, token } = vectors.inviteToken;
    const seal = jest.spyOn(CommunityOperationProof, 'seal');
    const device = await KeyPair.generate();
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce({
          communityId: 'community-1',
          networkId: 'network-1',
          token,
        })
        .mockResolvedValueOnce({ id: 'community-1' }),
    } as unknown as HttpJsonClient;
    const session = {
      deviceCredentialKeyPair: device,
      identity: { id: 'identity-1' },
      keyPair: device,
    } as unknown as Session;
    const api = new PigeonCommunityInvitationApi(
      http,
      { headers: jest.fn().mockResolvedValue({}) } as unknown as RequestSigner,
      { frontier: jest.fn().mockResolvedValue(['c'.repeat(43)]) } as never,
      publicMutationSignerAt(),
    );

    await api.acceptInviteLink(session, token);

    const body = JSON.parse(
      (
        (http.request as jest.Mock).mock.calls[1] as [string, { body: string }]
      )[1].body,
    ) as {
      mutation: Record<string, unknown>;
      operation: { mutation: Record<string, unknown>; parents: string[] };
      usedAt: number;
    };

    expect(seal.mock.calls[0]?.[0].args).toEqual({
      identityId: 'identity-1',
      method: 'invite_link',
      reference,
    });
    expect(body.operation.parents).toEqual(['c'.repeat(43)]);
    expect(body.operation.mutation).toMatchObject({
      sequence: 0,
      store: 'communityOperations',
    });

    expect(body.usedAt).toEqual(expect.any(Number));
    expect(body.mutation).toMatchObject({
      kind: 'put',
      predecessor: null,
      recordId: `invite-use:${token}:identity-1`,
      store: 'requests',
    });
  });
});
