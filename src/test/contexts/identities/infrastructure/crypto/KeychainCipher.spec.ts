import {
  EncryptedPayload,
  KeyPair,
  KeychainSignature,
  PublicKey,
  Signature,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';
import { InvalidFormatError } from '@haskou/value-objects';

import type { KeychainResource } from '../../../../../contexts/identities/infrastructure/http/resources/KeychainResource';
import type { LocalKeychain } from '../../../../../contexts/identities/infrastructure/keychain/LocalKeychain';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { KeychainCipher } from '../../../../../contexts/identities/infrastructure/crypto/KeychainCipher';

describe(KeychainCipher.name, () => {
  let owner: KeyPair;

  beforeAll(async () => {
    owner = await KeyPair.generate();
  });

  function ownerSession(extra: Record<string, unknown> = {}): Session {
    return {
      identity: { id: owner.toPrimitives().publicKey },
      keyPair: owner,
      password: 'secret',
      ...extra,
    } as unknown as Session;
  }

  it('signs the initial keychain with the owner identity key', () => {
    const encrypt = jest.fn().mockReturnValue({ toString: () => 'encrypted' });

    const result = new KeychainCipher().encryptForPublish(
      ownerSession({ deviceSealedRootKey: { encrypt } }),
      undefined,
      { conversations: {}, version: 1 },
    );

    expect(result.body).toEqual({
      encryptedPayload: 'encrypted',
      previousKeychainExternalIdentifier: null,
      signature: expect.any(String),
      timestamp: expect.any(Number),
      version: 1,
    });
    expect(() =>
      KeychainSignature.verify(
        {
          encryptedPayload: 'encrypted',
          ownerIdentityId: IdentityId.normalize(owner.toPrimitives().publicKey),
          timestamp: result.body.timestamp,
          version: 1,
        },
        new Signature(result.body.signature),
        new PublicKey(owner.toPrimitives().publicKey),
      ),
    ).not.toThrow();
  });

  it('signs the previous keychain external identifier when present', () => {
    const encrypt = jest.fn().mockReturnValue({ toString: () => 'encrypted' });

    const result = new KeychainCipher().encryptForPublish(
      ownerSession({ deviceSealedRootKey: { encrypt } }),
      {
        keychain: { conversations: {}, version: 1 },
        keychainExternalIdentifier: 'keychain-previous',
      },
      { conversations: {}, version: 1 },
    );

    expect(result.body.previousKeychainExternalIdentifier).toBe(
      'keychain-previous',
    );
    expect(() =>
      KeychainSignature.verify(
        {
          encryptedPayload: 'encrypted',
          ownerIdentityId: IdentityId.normalize(owner.toPrimitives().publicKey),
          previousKeychainExternalIdentifier: 'keychain-previous',
          timestamp: result.body.timestamp,
          version: 2,
        },
        new Signature(result.body.signature),
        new PublicKey(owner.toPrimitives().publicKey),
      ),
    ).not.toThrow();
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
      ownerSession({ masterKey, ...extra });

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

    it('refuses a head whose sealed version is not a keychain version', () => {
      const head = {
        encryptedPayload: rootKey
          .encrypt(JSON.stringify({ conversations: {}, version: -1 }))
          .toString(),
      } as KeychainResource;

      expect(() =>
        new KeychainCipher().decrypt(
          sessionWith({ deviceSealedRootKey: rootKey }),
          head,
        ),
      ).toThrow(InvalidFormatError);
    });

    it('refuses a head without a sealed version whose resource version is not a keychain version', () => {
      const head = {
        encryptedPayload: rootKey
          .encrypt(JSON.stringify({ conversations: {} }))
          .toString(),
        version: 1.5,
      } as KeychainResource;

      expect(() =>
        new KeychainCipher().decrypt(
          sessionWith({ deviceSealedRootKey: rootKey }),
          head,
        ),
      ).toThrow(InvalidFormatError);
    });

    it('refuses to publish without a device-sealed root', () => {
      expect(() =>
        new KeychainCipher().encryptForPublish(
          sessionWith(),
          undefined,
          keychain,
        ),
      ).toThrow();
    });

    it('seals the publish under the root alone', () => {
      const { body } = new KeychainCipher().encryptForPublish(
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
