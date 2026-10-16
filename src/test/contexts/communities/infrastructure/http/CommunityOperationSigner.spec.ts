import { CommitmentId, KeyPair } from '@haskou/pigeon-swarm-crypto';
import vectors from '@haskou/pigeon-swarm-crypto/vectors/community-operation.json';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { CommunityOperationSigner } from '../../../../../contexts/communities/infrastructure/http/CommunityOperationSigner';
import { PublicMutationSigner } from '../../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { publicMutationSignerAt } from '../../../../shared/infrastructure/crypto/publicMutationSignerAt';

// The vectors ship with @haskou/pigeon-swarm-crypto: ed25519 is deterministic,
// so even signatures match.
// Its signers use one key as both identity key and device credential.
type Vector = (typeof vectors.cases)[number];

function sessionOf(signer: keyof typeof vectors.keys): Session {
  const key = vectors.keys[signer];
  const keyPair = KeyPair.fromPrimitives({
    privateKey: key.privateKeyPem,
    publicKey: key.publicKeyPem,
  } as never);

  return {
    deviceCredentialKeyPair: keyPair,
    identity: { id: key.identityId },
    keyPair,
  } as unknown as Session;
}

describe(CommunityOperationSigner.name, () => {
  const signer = new CommunityOperationSigner(publicMutationSignerAt());

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(Object.entries(vectors.communities))(
    'derives the %s community id like the node',
    (_name, community) => {
      const preimage = JSON.parse(community.communityIdPreimage) as {
        networkId: string;
        nonce: string;
        ownerIdentityId: string;
      };

      expect(
        CommitmentId.community(
          preimage.networkId,
          preimage.ownerIdentityId,
          preimage.nonce,
        ),
      ).toBe(community.communityId);
    },
  );

  it.each(vectors.cases)(
    'signs $name byte for byte like the node',
    async (vector: Vector) => {
      const { derived, input } = vector;

      jest
        .spyOn(PublicMutationSigner.prototype as never, 'operationId')
        .mockReturnValue(input.operationId as never);

      const operation = await signer.sign(
        sessionOf(input.signer as keyof typeof vectors.keys),
        {
          action: input.action,
          args: input.args,
          communityId: input.communityId,
          createdAt: input.createdAt,
          networkId: input.networkId,
          parents: [...input.parents].reverse(),
        },
      );

      expect(operation).toEqual(derived.requestOperation);
      expect(operation.mutation.recordId).toBe(derived.recordId);
      expect(operation.mutation.payloadDigest).toBe(derived.payloadDigest);
    },
  );
});
