import { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { canonicalJson } from '../../../../shared/infrastructure/crypto/canonicalJson';
import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';

describe(PublicMutationSigner.name, () => {
  it('produces a device-signed mutation bound to scope, payload and position', async () => {
    const device = await KeyPair.generate();
    const session = {
      deviceCredentialKeyPair: device,
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const mutation = new PublicMutationSigner().sign(
      session,
      {
        kind: 'put',
        payload: { a: 1, b: 2 },
        recordId: 'record-1',
        store: 'pins',
      },
      { predecessor: 'p'.repeat(43), sequence: 3 },
    );
    const { signature, ...body } = mutation;

    expect(mutation.payloadDigest).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mutation.operationId).toMatch(/^[A-Za-z0-9_-]{22,64}$/);
    expect(mutation).toMatchObject({
      predecessor: 'p'.repeat(43),
      sequence: 3,
    });
    expect(
      device
        .toPrimitives()
        .publicKey.includes(mutation.author.deviceCredential),
    ).toBe(true);
    expect(
      device
        .sign(`pigeon:public-mutation:v1\n${canonicalJson(body)}`)
        .toString(),
    ).toBe(signature);
  });
});

describe(canonicalJson.name, () => {
  it('sorts keys, drops undefined members and rejects unsafe numbers', () => {
    expect(
      canonicalJson({ a: 'é', b: [1, { c: null, d: 1 }], u: undefined }),
    ).toBe('{"a":"é","b":[1,{"c":null,"d":1}]}');
    expect(() => canonicalJson({ a: 1.5 })).toThrow(TypeError);
  });
});
