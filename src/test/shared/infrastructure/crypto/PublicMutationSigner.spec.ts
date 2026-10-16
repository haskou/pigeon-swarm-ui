import {
  KeyPair,
  PublicKey,
  PublicMutationSignature,
} from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';

function publicKeyOf(device: KeyPair): PublicKey {
  return new PublicKey(device.toPrimitives().publicKey);
}

describe(PublicMutationSigner.name, () => {
  it('produces a device-signed mutation bound to scope, payload and position', async () => {
    const device = await KeyPair.generate();
    const session = {
      deviceCredentialKeyPair: device,
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const signer = new PublicMutationSigner({
      current: () => Promise.resolve(7),
    });
    const mutation = await signer.sign(
      session,
      {
        kind: 'put',
        payload: { a: 1, b: 2 },
        recordId: 'record-1',
        store: 'pins',
      },
      { predecessor: 'p'.repeat(43), sequence: 3 },
    );

    expect(mutation.payloadDigest).toBe(
      PublicMutationSignature.payloadDigest({ a: 1, b: 2 }),
    );
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
    expect(() =>
      PublicMutationSignature.verify(mutation, publicKeyOf(device)),
    ).not.toThrow();
    expect(signer.digestOf(mutation)).toBe(
      PublicMutationSignature.digest(mutation),
    );
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

    expect(scoped.frontier).toEqual(frontier);
    expect(plain).not.toHaveProperty('frontier');
    expect(() =>
      PublicMutationSignature.verify(scoped, publicKeyOf(device)),
    ).not.toThrow();
    expect(() =>
      PublicMutationSignature.verify(plain, publicKeyOf(device)),
    ).not.toThrow();
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
