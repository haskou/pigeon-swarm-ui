import { EncryptedPayload, SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { KeychainResource } from '../../../../../contexts/identities/infrastructure/http/resources/KeychainResource';
import type { LocalKeychain } from '../../../../../contexts/identities/infrastructure/keychain/LocalKeychain';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { KeychainCipher } from '../../../../../contexts/identities/infrastructure/crypto/KeychainCipher';

describe(KeychainCipher.name, () => {
  it('signs the canonical initial keychain domain payload', async () => {
    const sign = jest.fn().mockResolvedValue({ toString: () => 'signature' });
    const encrypt = jest.fn().mockReturnValue({ toString: () => 'encrypted' });
    const session = {
      deviceSealedRootKey: { encrypt },
      identity: {
        id: '-----BEGIN PUBLIC KEY-----\nidentity-1\n-----END PUBLIC KEY-----',
      },
      keyPair: { sign },
      password: 'secret',
    } as unknown as Session;

    const result = await new KeychainCipher().encryptForPublish(
      session,
      undefined,
      { conversations: {}, version: 1 },
    );
    const [signaturePayload] = sign.mock.calls[0] as [string];

    expect(JSON.parse(signaturePayload)).toEqual({
      encryptedPayload: 'encrypted',
      ownerIdentityId: 'identity-1',
      timestamp: expect.any(Number),
      version: 1,
    });
    expect(result.body).toEqual({
      encryptedPayload: 'encrypted',
      previousKeychainExternalIdentifier: null,
      signature: 'signature',
      timestamp: expect.any(Number),
      version: 1,
    });
  });

  it('signs the previous keychain external identifier when present', async () => {
    const sign = jest.fn().mockResolvedValue({ toString: () => 'signature' });
    const encrypt = jest.fn().mockReturnValue({ toString: () => 'encrypted' });
    const session = {
      deviceSealedRootKey: { encrypt },
      identity: { id: 'identity-1' },
      keyPair: { sign },
      password: 'secret',
    } as unknown as Session;

    const result = await new KeychainCipher().encryptForPublish(
      session,
      {
        keychain: { conversations: {}, version: 1 },
        keychainExternalIdentifier: 'keychain-previous',
      },
      { conversations: {}, version: 1 },
    );
    const [signaturePayload] = sign.mock.calls[0] as [string, string];

    expect(JSON.parse(signaturePayload)).toEqual({
      encryptedPayload: 'encrypted',
      ownerIdentityId: 'identity-1',
      previousKeychainExternalIdentifier: 'keychain-previous',
      timestamp: expect.any(Number),
      version: 2,
    });
    expect(result.body.previousKeychainExternalIdentifier).toBe(
      'keychain-previous',
    );
  });

  describe('device-sealed root only', () => {
    const masterKey = SymmetricKey.generate();
    const rootKey = SymmetricKey.generate();
    const keychain: LocalKeychain = { conversations: {}, version: 1 };
    const sealedUnder = (key: SymmetricKey): KeychainResource =>
      ({
        encryptedPayload: key.encrypt(JSON.stringify(keychain)).toString(),
      }) as KeychainResource;
    const sessionWith = (extra: Record<string, unknown> = {}): Session =>
      ({
        identity: { id: 'identity-1' },
        keyPair: {
          sign: jest.fn().mockResolvedValue({ toString: () => 'signature' }),
        },
        masterKey,
        password: 'secret',
        ...extra,
      }) as unknown as Session;

    it('opens a head sealed under the root', () => {
      expect(
        new KeychainCipher().decrypt(
          sessionWith({ deviceSealedRootKey: rootKey }),
          sealedUnder(rootKey),
        ),
      ).toMatchObject({ version: 1 });
    });

    it('does not open a head sealed under the master key while a root is held', () => {
      expect(() =>
        new KeychainCipher().decrypt(
          sessionWith({ deviceSealedRootKey: rootKey }),
          sealedUnder(masterKey),
        ),
      ).toThrow();
    });

    it('does not open a head sealed under the master key without a root', () => {
      expect(() =>
        new KeychainCipher().decrypt(sessionWith(), sealedUnder(masterKey)),
      ).toThrow();
    });

    it('refuses to publish without a device-sealed root', async () => {
      await expect(
        new KeychainCipher().encryptForPublish(
          sessionWith(),
          undefined,
          keychain,
        ),
      ).rejects.toThrow();
    });

    it('seals the publish under the root alone', async () => {
      const { body } = await new KeychainCipher().encryptForPublish(
        sessionWith({ deviceSealedRootKey: rootKey }),
        undefined,
        keychain,
      );
      const payload = new EncryptedPayload(body.encryptedPayload);

      expect(() => rootKey.decrypt(payload)).not.toThrow();
      expect(() => masterKey.decrypt(payload)).toThrow();
    });
  });
});
