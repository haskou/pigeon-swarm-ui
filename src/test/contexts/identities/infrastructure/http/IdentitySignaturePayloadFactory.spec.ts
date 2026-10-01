import type { IdentityResource } from '../../../../../shared/domain/pigeonResources.types';

import { IdentitySignaturePayloadFactory } from '../../../../../contexts/identities/infrastructure/http/IdentitySignaturePayloadFactory';

describe(IdentitySignaturePayloadFactory.name, () => {
  it('builds the canonical initial identity payload', () => {
    const payload = new IdentitySignaturePayloadFactory().createInitial({
      deviceCredential: 'device-credential',
      deviceCredentialCommitment: 'device-commitment',
      id: '-----BEGIN PUBLIC KEY-----\nidentity-1\n-----END PUBLIC KEY-----',
      networks: ['network-1', 'network-1'],
      profile: {
        biography: undefined,
        handle: ' @Ada ',
        name: 'Ada',
      },
      recoveryAuthority: 'recovery-authority',
      timestamp: 1,
    });

    expect(Object.keys(payload)).toEqual([
      'authorizationRevision',
      'deviceCredential',
      'deviceCredentialCommitment',
      'id',
      'networks',
      'previousIdentityExternalIdentifier',
      'profile',
      'recoveryAuthority',
      'timestamp',
      'version',
    ]);
    expect(JSON.stringify(payload)).not.toContain(
      'previousIdentityExternalIdentifier',
    );
    expect(payload).toEqual({
      authorizationRevision: 0,
      deviceCredential: 'device-credential',
      deviceCredentialCommitment: 'device-commitment',
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
      recoveryAuthority: 'recovery-authority',
      timestamp: 1,
      version: 1,
    });
  });

  it('builds the canonical identity update payload', () => {
    const identity = {
      authorizationRevision: 4,
      deviceCredential: 'device-credential',
      deviceCredentialCommitment: 'device-commitment',
      id: '-----BEGIN PUBLIC KEY-----\nidentity-1\n-----END PUBLIC KEY-----',
      networks: ['network-1'],
      profile: { name: 'Ada' },
      recoveryAuthority: 'recovery-authority',
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
      'authorizationRevision',
      'deviceCredential',
      'deviceCredentialCommitment',
      'id',
      'networks',
      'previousIdentityExternalIdentifier',
      'profile',
      'recoveryAuthority',
      'timestamp',
      'version',
    ]);
    expect(payload).toEqual({
      authorizationRevision: 4,
      deviceCredential: 'device-credential',
      deviceCredentialCommitment: 'device-commitment',
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
      recoveryAuthority: 'recovery-authority',
      timestamp: 2,
      version: 2,
    });
    expect(JSON.stringify(payload)).toContain(
      '"profile":{"banner":"banner-cid","handle":"ada","name":"Ada Updated"',
    );
  });
});
