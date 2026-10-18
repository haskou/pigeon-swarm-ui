import { ProofOfWork } from '@haskou/pigeon-swarm-crypto';

import type { IdentityResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityResource';

import { IdentitySignaturePayloadFactory } from '../../../../../contexts/identities/infrastructure/http/IdentitySignaturePayloadFactory';

describe(IdentitySignaturePayloadFactory.name, () => {
  it('builds the canonical initial identity payload', async () => {
    const payload = await new IdentitySignaturePayloadFactory().createInitial({
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
      'admissionNonce',
      'authorizationRevision',
      'deviceCredential',
      'deviceCredentialCommitment',
      'id',
      'mailboxHome',
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
      admissionNonce: expect.stringMatching(/^\d+$/),
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

  it('builds the canonical identity update payload', async () => {
    const identity = {
      admissionNonce: '0',
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

    const payload = await new IdentitySignaturePayloadFactory().createUpdate({
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
      'admissionNonce',
      'authorizationRevision',
      'deviceCredential',
      'deviceCredentialCommitment',
      'id',
      'mailboxHome',
      'networks',
      'previousIdentityExternalIdentifier',
      'profile',
      'recoveryAuthority',
      'timestamp',
      'version',
    ]);
    expect(payload).toEqual({
      admissionNonce: expect.stringMatching(/^\d+$/),
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

  describe('mailbox home hint', () => {
    const id =
      '-----BEGIN PUBLIC KEY-----\nidentity-1\n-----END PUBLIC KEY-----';
    const initial = {
      deviceCredential: 'device-credential',
      deviceCredentialCommitment: 'device-commitment',
      id,
      networks: ['network-1'],
      profile: { name: 'Ada' },
      recoveryAuthority: 'recovery-authority',
      timestamp: 1,
    };
    const identity = {
      admissionNonce: '0',
      authorizationRevision: 4,
      deviceCredential: 'device-credential',
      deviceCredentialCommitment: 'device-commitment',
      id,
      mailboxHome: 'https://node.example',
      networks: ['network-1'],
      profile: { name: 'Ada' },
      recoveryAuthority: 'recovery-authority',
      signature: 'signature',
      timestamp: 1,
      version: 1,
    } as IdentityResource;

    it('signs the published node base between id and networks', async () => {
      const payload = await new IdentitySignaturePayloadFactory(
        () => 'https://node.example',
      ).createInitial(initial);

      expect(payload.mailboxHome).toBe('https://node.example');
      expect(JSON.stringify(payload)).toContain(
        '"id":"identity-1","mailboxHome":"https://node.example","networks":["network-1"]',
      );
    });

    it('publishes the path-prefixed base the node is served under', async () => {
      const payload = await new IdentitySignaturePayloadFactory(
        () => 'https://node.example/api',
      ).createInitial(initial);

      expect(payload.mailboxHome).toBe('https://node.example/api');
    });

    it('omits the hint when the published base is not canonical', async () => {
      const payload = await new IdentitySignaturePayloadFactory(
        () => 'https://node.example/api/',
      ).createInitial(initial);

      expect(payload.mailboxHome).toBeUndefined();
      expect(JSON.stringify(payload)).not.toContain('mailboxHome');
    });

    it('resends the current hint on profile updates', async () => {
      const payload = await new IdentitySignaturePayloadFactory().createUpdate({
        identity,
        profile: { name: 'Ada Updated' },
        timestamp: 2,
      });

      expect(payload.mailboxHome).toBe('https://node.example');
    });

    it('drops a stored hint that no longer passes validation', async () => {
      const payload = await new IdentitySignaturePayloadFactory().createUpdate({
        identity: { ...identity, mailboxHome: 'http://node.example' },
        profile: { name: 'Ada Updated' },
        timestamp: 2,
      });

      expect(payload.mailboxHome).toBeUndefined();
    });
  });

  describe('admission proof', () => {
    const identity = {
      admissionNonce: 'carried-over',
      authorizationRevision: 0,
      deviceCredential: 'device-credential',
      deviceCredentialCommitment: 'device-commitment',
      id: 'identity-1',
      networks: ['network-1'],
      profile: { name: 'Ada' },
      recoveryAuthority: 'recovery-authority',
      signature: 'signature',
      timestamp: 1,
      version: 1,
    } as IdentityResource;

    it('keeps the proof while the networks do not change', async () => {
      const payload = await new IdentitySignaturePayloadFactory().createUpdate({
        identity,
        previousIdentityExternalIdentifier: 'cid-1',
        profile: { name: 'Ada', networks: ['network-1'] },
        timestamp: 2,
      });

      expect(payload.admissionNonce).toBe('carried-over');
    });

    it('mines fresh work for the networks it joins', async () => {
      const payload = await new IdentitySignaturePayloadFactory().createUpdate({
        identity,
        previousIdentityExternalIdentifier: 'cid-1',
        profile: { name: 'Ada', networks: ['network-2'] },
        timestamp: 2,
      });

      expect(payload.admissionNonce).not.toBe('carried-over');
      expect(
        ProofOfWork.identityAdmission('identity-1', payload.networks).verify(
          payload.admissionNonce,
          16,
        ),
      ).toBe(true);
    });
  });
});
