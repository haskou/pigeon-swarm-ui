import {
  CommitmentId,
  CommunityInvitationKey,
  CommunityInvitationPossession,
  KeyPair,
  PrivateKey,
} from '@haskou/pigeon-swarm-crypto';
import operationVectors from '@haskou/pigeon-swarm-crypto/vectors/community-operation.json';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { CommunityModerationLogSigner } from '../../../../../contexts/communities/infrastructure/http/CommunityModerationLogSigner';
import { CommunityOperationSigner } from '../../../../../contexts/communities/infrastructure/http/CommunityOperationSigner';
import { PigeonCommunityInvitationApi } from '../../../../../contexts/communities/infrastructure/http/PigeonCommunityInvitationApi';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { PublicMutationSigner } from '../../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { ScopeFrontierReader } from '../../../../../shared/infrastructure/http/ScopeFrontierReader';
import { publicMutationSignerAt } from '../../../../shared/infrastructure/crypto/publicMutationSignerAt';

const FRONTIER = 'F'.repeat(43);

interface SentRequest {
  body: Record<string, unknown>;
  path: string;
}

async function sessionOf(): Promise<Session> {
  const keyPair = await KeyPair.generate();
  const identityId = IdentityId.fromString(
    new PrivateKey(keyPair.toPrimitives().privateKey).getPublicKey().toString(),
  ).valueOf();

  return {
    deviceCredentialKeyPair: keyPair,
    identity: { id: identityId },
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

afterEach(() => {
  jest.restoreAllMocks();
});

describe(PigeonCommunityInvitationApi.name, () => {
  it('creates an invitation that names the key, not the secret', async () => {
    const log = jest.spyOn(CommunityModerationLogSigner.prototype, 'sign');
    const signed = jest.spyOn(CommunityOperationSigner.prototype, 'sign');
    const request = jest.fn().mockResolvedValue({});
    const { key, secret } = CommunityInvitationKey.generate();

    await apiOver(request).create(await sessionOf(), 'community-1', {
      expiresAt: 5_000,
      invitationKey: key.publicKey(),
      maxUses: 3,
    });

    const { body, path } = sent(request);
    const operation = body.operation as {
      mutation: { recordId: string; store: string };
    };

    expect(path).toBe('/communities/community-1/invitations');
    expect(signed.mock.calls[0]?.[1]).toMatchObject({
      action: 'invitation_created',
      args: {
        expiresAt: 5_000,
        invitationKey: key.publicKey(),
        maxUses: 3,
      },
    });
    expect(operation.mutation.store).toBe('communityOperations');
    expect(log.mock.calls[0]?.[1].target).toEqual({
      id: operation.mutation.recordId.split(':op:')[1],
      type: 'invitation',
    });
    expect(JSON.stringify(body)).not.toContain(secret);
  });

  it('names the invitation by its operation digest, like the node', async () => {
    const { derived, input } = operationVectors.cases.find(
      ({ name }) => name === 'invitation_created',
    ) as (typeof operationVectors.cases)[number];
    const owner = operationVectors.keys.owner;
    const keyPair = KeyPair.fromPrimitives({
      privateKey: owner.privateKeyPem,
      publicKey: owner.publicKeyPem,
    } as never);
    const session = {
      deviceCredentialKeyPair: keyPair,
      identity: { id: owner.identityId },
      keyPair,
    } as unknown as Session;
    const request = jest.fn().mockResolvedValue({});
    const api = new PigeonCommunityInvitationApi(
      { request } as unknown as HttpJsonClient,
      { headers: jest.fn().mockResolvedValue({}) } as unknown as RequestSigner,
      {
        head: jest.fn().mockResolvedValue({
          frontier: input.parents,
          networkId: input.networkId,
        }),
      },
      publicMutationSignerAt(),
    );

    jest.spyOn(Date, 'now').mockReturnValue(input.createdAt);
    jest
      .spyOn(PublicMutationSigner.prototype as never, 'operationId')
      .mockReturnValue(input.operationId as never);

    await api.create(session, input.communityId, {
      expiresAt: input.args.expiresAt as number,
      invitationKey: input.args.invitationKey as string,
      maxUses: input.args.maxUses as number,
    });

    const { body } = sent(request);
    const moderationLog = body.moderationLog as {
      mutation: { recordId: string };
    };

    expect(body.operation).toEqual(derived.requestOperation);
    expect(moderationLog.mutation.recordId).toBe(
      CommitmentId.communityModerationLog(
        input.communityId,
        owner.identityId,
        'invitation_created',
        'invitation',
        derived.digest,
        input.createdAt,
      ),
    );
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
    const invitationId = 'A'.repeat(43);
    const networkId = '3f2b8c1e-5d4a-4c7e-9b1a-0a1b2c3d4e5f';
    const preview = {
      communityId: 'community-1',
      communityName: 'Guild',
      expiresAt: 5_000,
      invitationId,
      networkId,
    };

    await apiOver(request).claim(session, preview, secret);

    const { body, path } = sent(request);
    const identityId = session.identity.id;
    const fields = {
      communityId: 'community-1',
      identityId,
      invitationId,
      networkId,
    };

    expect(path).toBe(
      `/communities/community-1/invitations/${invitationId}/claims`,
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
      recordId: `invitation-claim:${invitationId}:${identityId}`,
      store: 'requests',
    });
    expect(JSON.stringify(body)).not.toContain(secret);
  });

  it('admits a claimant with a member_joined operation carrying its proofs', async () => {
    const signed = jest.spyOn(CommunityOperationSigner.prototype, 'sign');
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
      possession: 'possession',
    });
    expect(signed.mock.calls[0]?.[1]).toMatchObject({
      action: 'member_joined',
      args: {
        consent: 'consent',
        identityId: 'identity-2',
        invitationId: 'invitation-1',
        method: 'invitation',
        possession: 'possession',
      },
      parents: [FRONTIER],
    });
  });

  it('revokes with an operation and a log naming the invitation', async () => {
    const log = jest.spyOn(CommunityModerationLogSigner.prototype, 'sign');
    const signed = jest.spyOn(CommunityOperationSigner.prototype, 'sign');
    const request = jest.fn().mockResolvedValue({});

    await apiOver(request).revoke(
      await sessionOf(),
      'community-1',
      'invitation-1',
    );

    expect(sent(request).path).toBe(
      '/communities/community-1/invitations/invitation-1/revocation',
    );
    expect(signed.mock.calls[0]?.[1]).toMatchObject({
      action: 'invitation_revoked',
      args: { invitationId: 'invitation-1' },
    });
    expect(log.mock.calls[0]?.[1]).toMatchObject({
      action: 'invitation_revoked',
      target: { id: 'invitation-1', type: 'invitation' },
    });
  });
});
