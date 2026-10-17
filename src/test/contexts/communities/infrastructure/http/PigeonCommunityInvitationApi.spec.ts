import {
  CommunityInvitationKey,
  CommunityInvitationPossession,
  KeyPair,
} from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { CommunityModerationLogSigner } from '../../../../../contexts/communities/infrastructure/http/CommunityModerationLogSigner';
import { PigeonCommunityInvitationApi } from '../../../../../contexts/communities/infrastructure/http/PigeonCommunityInvitationApi';
import { ScopeFrontierReader } from '../../../../../shared/infrastructure/http/ScopeFrontierReader';
import { publicMutationSignerAt } from '../../../../shared/infrastructure/crypto/publicMutationSignerAt';

const FRONTIER = 'F'.repeat(43);

interface SentRequest {
  body: Record<string, unknown>;
  path: string;
}

async function sessionOf(): Promise<Session> {
  const keyPair = await KeyPair.generate();

  return {
    deviceCredentialKeyPair: keyPair,
    identity: { id: 'identity-1' },
    keyPair,
  } as unknown as Session;
}

function apiOver(request: jest.Mock): PigeonCommunityInvitationApi {
  return new PigeonCommunityInvitationApi(
    { request } as unknown as HttpJsonClient,
    { headers: jest.fn().mockResolvedValue({}) } as unknown as RequestSigner,
    {
      head: jest
        .fn()
        .mockResolvedValue({ frontier: [FRONTIER], networkId: 'network-1' }),
    },
    publicMutationSignerAt(),
  );
}

function sent(request: jest.Mock, index = 0): SentRequest {
  const [path, options] = request.mock.calls[index] as [
    string,
    { body: string },
  ];

  return { body: JSON.parse(options.body), path };
}

beforeEach(() => {
  jest
    .spyOn(ScopeFrontierReader.prototype, 'community')
    .mockResolvedValue([FRONTIER]);
});

describe(PigeonCommunityInvitationApi.name, () => {
  it('creates an invitation that names the key, not the secret', async () => {
    const log = jest.spyOn(CommunityModerationLogSigner.prototype, 'sign');
    const request = jest.fn().mockResolvedValue({});
    const { key, secret } = CommunityInvitationKey.generate();

    await apiOver(request).create(await sessionOf(), 'community-1', {
      expiresAt: 5_000,
      invitationKey: key.publicKey(),
      maxUses: 3,
    });

    const { body, path } = sent(request);
    const operation = body.operation as {
      action: string;
      args: Record<string, unknown>;
      mutation: { recordId: string; store: string };
    };

    expect(path).toBe('/communities/community-1/invitations');
    expect(operation.action).toBe('invitation_created');
    expect(operation.args).toEqual({
      expiresAt: 5_000,
      invitationKey: key.publicKey(),
      maxUses: 3,
    });
    expect(operation.mutation.store).toBe('communityOperations');
    expect(log.mock.calls[0]?.[1].target).toEqual({
      id: operation.mutation.recordId,
      type: 'invitation',
    });
    expect(JSON.stringify(body)).not.toContain(secret);
  });

  it('previews with the invitation key as bearer token', async () => {
    const request = jest.fn().mockResolvedValue({});

    await apiOver(request).preview('community-1', 'public-key');

    expect(request).toHaveBeenCalledWith(
      '/communities/community-1/invitation-preview',
      { headers: { Authorization: 'Bearer public-key' }, method: 'GET' },
    );
  });

  it('claims with consent and possession proofs, never the secret', async () => {
    const request = jest.fn().mockResolvedValue({});
    const session = await sessionOf();
    const { key, secret } = CommunityInvitationKey.generate();
    const preview = {
      communityId: 'community-1',
      communityName: 'Guild',
      expiresAt: 5_000,
      invitationId: 'invitation-1',
      networkId: 'network-1',
    };

    await apiOver(request).claim(session, preview, secret);

    const { body, path } = sent(request);
    const fields = {
      communityId: 'community-1',
      identityId: 'identity-1',
      invitationId: 'invitation-1',
      networkId: 'network-1',
    };

    expect(path).toBe(
      '/communities/community-1/invitations/invitation-1/claims',
    );
    expect(() =>
      CommunityInvitationPossession.verify(
        fields,
        body.possession as string,
        key.publicKey(),
      ),
    ).not.toThrow();
    expect(body.consent).toEqual(expect.any(String));
    expect(body.mutation).toMatchObject({
      frontier: [FRONTIER],
      kind: 'put',
      recordId: 'invitation-claim:invitation-1:identity-1',
      store: 'requests',
    });
    expect(JSON.stringify(body)).not.toContain(secret);
  });

  it('admits a claimant with a member_joined operation carrying its proofs', async () => {
    const request = jest.fn().mockResolvedValue({});
    const claim = {
      communityId: 'community-1',
      consent: 'consent',
      id: 'invitation-claim:invitation-1:identity-2',
      identityId: 'identity-2',
      invitationId: 'invitation-1',
      possession: 'possession',
    };

    await apiOver(request).admit(await sessionOf(), claim);

    const { body, path } = sent(request);

    expect(path).toBe(
      '/communities/community-1/invitations/invitation-1/admissions',
    );
    expect(body).toMatchObject({
      consent: 'consent',
      identityId: 'identity-2',
      operation: {
        action: 'member_joined',
        args: {
          consent: 'consent',
          identityId: 'identity-2',
          invitationId: 'invitation-1',
          method: 'invitation',
          possession: 'possession',
        },
        parents: [FRONTIER],
      },
      possession: 'possession',
    });
  });

  it('revokes with an operation and a log naming the invitation', async () => {
    const log = jest.spyOn(CommunityModerationLogSigner.prototype, 'sign');
    const request = jest.fn().mockResolvedValue({});

    await apiOver(request).revoke(
      await sessionOf(),
      'community-1',
      'invitation-1',
    );

    const { body, path } = sent(request);

    expect(path).toBe(
      '/communities/community-1/invitations/invitation-1/revocation',
    );
    expect(body.operation).toMatchObject({
      action: 'invitation_revoked',
      args: { invitationId: 'invitation-1' },
    });
    expect(log.mock.calls[0]?.[1]).toMatchObject({
      action: 'invitation_revoked',
      target: { id: 'invitation-1', type: 'invitation' },
    });
  });
});
