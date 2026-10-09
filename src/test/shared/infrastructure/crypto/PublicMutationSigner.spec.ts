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
    const mutation = await new PublicMutationSigner({
      current: () => Promise.resolve(7),
    }).sign(
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
      author: {
        authorizationRevision: 7,
        deviceCredential: expect.any(String) as string,
        identityId: 'identity-1',
      },
      predecessor: 'p'.repeat(43),
      sequence: 3,
      version: 2,
    });
    expect(
      device
        .toPrimitives()
        .publicKey.includes(mutation.author.deviceCredential),
    ).toBe(true);
    expect(
      device
        .sign(`pigeon:public-mutation:v2\n${canonicalJson(body)}`)
        .toString(),
    ).toBe(signature);
  });

  it('signs the scope frontier into the body and omits it when absent', async () => {
    const device = await KeyPair.generate();
    const session = {
      deviceCredentialKeyPair: device,
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const signer = new PublicMutationSigner({
      current: () => Promise.resolve(1),
    });
    const intent = {
      kind: 'put' as const,
      payload: { id: 'r' },
      recordId: 'r',
      store: 'pins' as const,
    };
    const frontier = ['f'.repeat(43)];
    const first = PublicMutationSigner.FIRST_POSITION;
    const scoped = await signer.sign(session, { ...intent, frontier }, first);
    const plain = await signer.sign(session, intent, first);
    const { signature, ...body } = scoped;

    expect(scoped.frontier).toEqual(frontier);
    expect(plain).not.toHaveProperty('frontier');
    expect(
      device
        .sign(`pigeon:public-mutation:v2\n${canonicalJson(body)}`)
        .toString(),
    ).toBe(signature);
  });

  it('asks the revision source for the signing session on every signature', async () => {
    const device = await KeyPair.generate();
    const session = {
      deviceCredentialKeyPair: device,
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const current = jest.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(5);
    const signer = new PublicMutationSigner({ current });
    const draft = {
      kind: 'put' as const,
      payload: { a: 1 },
      recordId: 'record-1',
      store: 'pins' as const,
    };

    const first = await signer.sign(
      session,
      draft,
      PublicMutationSigner.FIRST_POSITION,
    );
    const second = await signer.sign(
      session,
      draft,
      PublicMutationSigner.FIRST_POSITION,
    );

    expect(current).toHaveBeenCalledWith(session);
    expect(first.author.authorizationRevision).toBe(4);
    expect(second.author.authorizationRevision).toBe(5);
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
