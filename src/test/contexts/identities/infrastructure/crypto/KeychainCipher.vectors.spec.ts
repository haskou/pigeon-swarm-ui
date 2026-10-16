import {
  EncryptedPayload,
  KeyPair,
  type SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';
import vectors from '@haskou/pigeon-swarm-crypto/vectors/keychain-signature.json';
import { mock } from 'jest-mock-extended';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { KeychainCipher } from '../../../../../contexts/identities/infrastructure/crypto/KeychainCipher';

const owner = KeyPair.fromPrimitives({
  privateKey: vectors.keys.owner.privateKeyPem,
  publicKey: vectors.keys.owner.publicKeyPem,
} as never);

describe('keychain signature vectors from @haskou/pigeon-swarm-crypto', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it.each(vectors.accepted)('signs $name byte for byte', (vector) => {
    const root = mock<SymmetricKey>();
    root.encrypt.mockReturnValue(
      new EncryptedPayload(vector.input.encryptedPayload),
    );
    const session = {
      deviceSealedRootKey: root,
      identity: { id: vectors.keys.owner.publicKeyPem },
      keyPair: owner,
    } as unknown as Session;
    jest.useFakeTimers({ now: vector.input.timestamp });

    const { body } = new KeychainCipher().encryptForPublish(
      session,
      vector.input.previousKeychainExternalIdentifier === null
        ? undefined
        : {
            keychain: { conversations: {}, version: vector.input.version - 1 },
            keychainExternalIdentifier:
              vector.input.previousKeychainExternalIdentifier,
          },
      { conversations: {}, version: 0 },
    );

    expect(body).toEqual({
      ...vector.input,
      signature: vector.expected.signature,
    });
  });
});
