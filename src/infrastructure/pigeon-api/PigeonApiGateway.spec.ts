import type { IdentityResource, Session } from '../../domain/types';
import type { HttpJsonClient } from '../http/HttpJsonClient';
import type { RequestSigner } from './RequestSigner';

import { PigeonApiGateway } from './PigeonApiGateway';

describe(PigeonApiGateway.name, () => {
  it('refreshes the current identity reference before signing profile updates', async () => {
    const currentIdentity = {
      encryptedKeyPair: {
        encryptedPrivateKey: 'encrypted-private-key',
        publicKey: 'public-key',
      },
      id: 'identity/with+symbols=',
      identityExternalIdentifier: 'current-identity-cid',
      networks: ['network-1'],
      profile: { name: 'Ada' },
      signature: 'current-signature',
      timestamp: 1,
      version: 7,
    } satisfies IdentityResource;
    const updatedIdentity = {
      ...currentIdentity,
      identityExternalIdentifier: 'next-identity-cid',
      profile: { biography: 'Hi', handle: 'ada', name: 'Ada Next' },
      version: 8,
    } satisfies IdentityResource;
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce(currentIdentity)
        .mockResolvedValueOnce(updatedIdentity),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      encryptedKeyPair: {
        sign: jest.fn().mockResolvedValue({
          toString: () => 'identity-signature',
        }),
      },
      identity: {
        ...currentIdentity,
        identityExternalIdentifier: undefined,
        previousIdentityExternalIdentifier: undefined,
        version: 1,
      },
      keychain: { conversations: {}, version: 0 },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.updateIdentityProfile(session, {
        biography: 'Hi',
        handle: 'ada',
        name: 'Ada Next',
      }),
    ).resolves.toBe(updatedIdentity);

    expect(http.request).toHaveBeenNthCalledWith(
      1,
      '/identities/identity%2Fwith%2Bsymbols%3D',
    );
    const [, putInit] = (http.request as jest.Mock).mock.calls[1] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(putInit.body as string) as IdentityResource;

    expect(body.previousIdentityExternalIdentifier).toBe(
      'current-identity-cid',
    );
    expect(body.version).toBe(8);
    expect(body.signature).toBe('identity-signature');
    const [signedPayload, signedPassword] = (
      session.encryptedKeyPair.sign as jest.Mock
    ).mock.calls[0] as [string, string];
    const parsedSignedPayload = JSON.parse(
      signedPayload,
    ) as Partial<IdentityResource>;

    expect(parsedSignedPayload).toEqual({
      encryptedKeyPair: currentIdentity.encryptedKeyPair,
      id: currentIdentity.id,
      networks: currentIdentity.networks,
      previousIdentityExternalIdentifier: 'current-identity-cid',
      profile: {
        biography: 'Hi',
        handle: 'ada',
        name: 'Ada Next',
      },
      timestamp: expect.any(Number),
      version: 8,
    });
    expect(signedPassword).toBe(session.password);
  });

  it('uploads public profile files as signed raw bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const upload = {
      cid: 'bafy-avatar',
      contentType: 'image/png',
      filename: 'avatar.png',
      size: 3,
    };
    const http = {
      request: jest.fn().mockResolvedValue(upload),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const file = {
      arrayBuffer: jest.fn().mockResolvedValue(bytes),
      name: 'avatar.png',
      type: 'image/png',
    } as unknown as File;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.uploadPublicFile(session, file)).resolves.toBe(upload);

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/ipfs/public',
      bytes,
    );
    expect(http.request).toHaveBeenCalledWith('/ipfs/public', {
      body: bytes,
      headers: {
        'Content-Type': 'image/png',
        'X-Filename': 'avatar.png',
        'X-Signature': 'http-signature',
      },
      method: 'POST',
    });
  });
});
