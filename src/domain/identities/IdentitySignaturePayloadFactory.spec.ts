import type { IdentityResource } from '../types';

import { IdentitySignaturePayloadFactory } from './IdentitySignaturePayloadFactory';

describe(IdentitySignaturePayloadFactory.name, () => {
  it('builds the canonical initial identity payload', () => {
    const payload = new IdentitySignaturePayloadFactory().createInitial({
      encryptedKeyPair: {
        encryptedPrivateKey: 'encrypted',
        publicKey: 'public',
      },
      id: '-----BEGIN PUBLIC KEY-----\nidentity-1\n-----END PUBLIC KEY-----',
      networks: ['network-1', 'network-1'],
      profile: {
        biography: undefined,
        handle: ' @Ada ',
        name: 'Ada',
      },
      timestamp: 1,
    });

    expect(Object.keys(payload)).toEqual([
      'encryptedKeyPair',
      'id',
      'networks',
      'previousIdentityExternalIdentifier',
      'profile',
      'timestamp',
      'version',
    ]);
    expect(JSON.stringify(payload)).not.toContain(
      'previousIdentityExternalIdentifier',
    );
    expect(payload).toEqual({
      encryptedKeyPair: {
        encryptedPrivateKey: 'encrypted',
        publicKey: 'public',
      },
      id: 'identity-1',
      networks: ['network-1'],
      previousIdentityExternalIdentifier: undefined,
      profile: {
        banner: undefined,
        biography: undefined,
        handle: 'ada',
        name: 'Ada',
        picture: undefined,
      },
      timestamp: 1,
      version: 1,
    });
  });

  it('builds the canonical identity update payload', () => {
    const identity = {
      encryptedKeyPair: {
        encryptedPrivateKey: 'encrypted',
        publicKey: 'public',
      },
      id: '-----BEGIN PUBLIC KEY-----\nidentity-1\n-----END PUBLIC KEY-----',
      networks: ['network-1'],
      profile: { name: 'Ada' },
      signature: 'signature',
      timestamp: 1,
      version: 1,
    } as IdentityResource;

    const payload = new IdentitySignaturePayloadFactory().createUpdate({
      identity,
      previousIdentityExternalIdentifier: 'cid-1',
      profile: {
        banner: 'banner-cid',
        biography: undefined,
        handle: 'ada',
        name: 'Ada Updated',
        networks: ['network-2', 'network-1'],
        picture: undefined,
      },
      timestamp: 2,
    });

    expect(Object.keys(payload)).toEqual([
      'encryptedKeyPair',
      'id',
      'networks',
      'previousIdentityExternalIdentifier',
      'profile',
      'timestamp',
      'version',
    ]);
    expect(payload).toEqual({
      encryptedKeyPair: identity.encryptedKeyPair,
      id: 'identity-1',
      networks: ['network-1', 'network-2'],
      previousIdentityExternalIdentifier: 'cid-1',
      profile: {
        banner: 'banner-cid',
        biography: undefined,
        handle: 'ada',
        name: 'Ada Updated',
        picture: undefined,
      },
      timestamp: 2,
      version: 2,
    });
  });
});
