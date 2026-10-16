import { KeyPair } from '@haskou/pigeon-swarm-crypto';
import vectors from '@haskou/pigeon-swarm-crypto/vectors/signed-http-request.json';
import { Buffer } from 'buffer';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';

// The vectors ship with @haskou/pigeon-swarm-crypto, which the node verifies
// with. Ed25519 is deterministic, so signatures match byte for byte.
type Vector = (typeof vectors.cases)[number];

function sessionFromVectorKey(): Session {
  const { key } = vectors;
  const keyPair = KeyPair.fromPrimitives({
    privateKey: key.privateKeyPem,
    publicKey: key.publicKeyPem,
  } as never);

  return {
    authorizationEpoch: { valueOf: () => 'genesis' },
    authorizationRevision: { valueOf: () => 0 },
    deviceCredentialKeyPair: keyPair,
    identity: { id: key.identityId },
    keyPair,
  } as unknown as Session;
}

describe(RequestSigner.name, () => {
  it.each(vectors.cases)(
    'signs $name byte for byte like the node',
    async (vector: Vector) => {
      const { input } = vector;
      const signer = new RequestSigner(() => input.timestamp);
      const body =
        input.bodyBase64 === undefined
          ? input.body
          : Buffer.from(input.bodyBase64, 'base64');

      expect(
        signer.payload(input.method, input.path, input.timestamp, body),
      ).toBe(vector.derived.signingContent);
      await expect(
        signer.headers(sessionFromVectorKey(), input.method, input.path, body),
      ).resolves.toMatchObject({
        'X-Identity-Id': vector.headers['x-identity-id'],
        'X-Signature': vector.headers['x-signature'],
        'X-Timestamp': vector.headers['x-timestamp'],
      });
    },
  );

  it.each(vectors.rejected)(
    'does not reuse the node signature when the $name',
    async (vector: (typeof vectors.rejected)[number]) => {
      const { input } = vector;
      const signer = new RequestSigner(() => input.timestamp);

      await expect(
        signer.headers(
          sessionFromVectorKey(),
          input.method,
          input.path,
          input.body,
        ),
      ).resolves.not.toMatchObject({
        'X-Signature': vector.headers['x-signature'],
      });
    },
  );
});
