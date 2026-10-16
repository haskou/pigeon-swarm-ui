import { KeyPair } from '@haskou/pigeon-swarm-crypto';
import vectors from '@haskou/pigeon-swarm-crypto/vectors/community-moderation-log.json';

import type { CommunityModerationLogInput } from '../../../../../contexts/communities/infrastructure/http/CommunityModerationLogInput';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { CommunityModerationLogSigner } from '../../../../../contexts/communities/infrastructure/http/CommunityModerationLogSigner';
import { deriveModerationLogId } from '../../../../../contexts/communities/infrastructure/http/deriveCommunityRecordId';
import { PublicMutationSigner } from '../../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { publicMutationSignerAt } from '../../../../shared/infrastructure/crypto/publicMutationSignerAt';

// The vectors ship with @haskou/pigeon-swarm-crypto: ed25519 is deterministic,
// so even the signatures match.
type Vector = (typeof vectors.cases)[number];

function sessionOf(signer: keyof typeof vectors.keys): Session {
  const key = vectors.keys[signer];

  return {
    deviceCredentialKeyPair: KeyPair.fromPrimitives({
      privateKey: key.privateKeyPem,
      publicKey: key.publicKeyPem,
    } as never),
    identity: { id: key.identityId },
  } as unknown as Session;
}

describe(CommunityModerationLogSigner.name, () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(vectors.cases)(
    'derives the $name log id like the node',
    ({ derived, input }: Vector) => {
      expect(
        deriveModerationLogId(
          input.communityId,
          vectors.keys.moderator.identityId,
          input.action,
          input.target.type,
          input.target.id,
          input.createdAt,
        ),
      ).toBe(derived.id);
    },
  );

  it.each(vectors.cases)(
    'signs $name byte for byte like the node',
    async ({ derived, input }: Vector) => {
      const signer = new CommunityModerationLogSigner(
        publicMutationSignerAt(),
        { community: () => Promise.resolve(input.frontier) },
      );

      jest
        .spyOn(PublicMutationSigner.prototype as never, 'operationId')
        .mockReturnValue(input.operationId as never);

      const body = await signer.sign(
        sessionOf(input.signer as keyof typeof vectors.keys),
        {
          action: input.action as CommunityModerationLogInput['action'],
          communityId: input.communityId,
          createdAt: input.createdAt,
          details: { ...input.details, omitted: undefined },
          target: input.target as CommunityModerationLogInput['target'],
        },
      );

      expect(body).toEqual(derived.body);
      expect(body.mutation.payloadDigest).toBe(derived.payloadDigest);
    },
  );
});
