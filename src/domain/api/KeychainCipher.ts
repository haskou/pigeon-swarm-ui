import { EncryptedPayload, StringValueObject } from '@haskou/value-objects';

import type { KeychainResource, LocalKeychain, Session } from '../types';

type PublishedKeychainPayload = {
  encryptedPayload: string;
  previousKeychainExternalIdentifier: string | null;
  signature: string;
  timestamp: number;
  version: number;
};

export class KeychainCipher {
  public async decrypt(
    session: Session,
    keychain: KeychainResource,
  ): Promise<LocalKeychain> {
    const decrypted = await session.encryptedKeyPair.decrypt(
      new EncryptedPayload(keychain.encryptedPayload),
      new StringValueObject(session.password),
    );

    const parsed = JSON.parse(decrypted.toString()) as Partial<LocalKeychain>;

    return {
      conversations: parsed.conversations ?? {},
      version: parsed.version ?? keychain.version ?? 0,
    };
  }

  public async encryptForPublish(
    session: Session,
    nextKeychain: LocalKeychain,
  ): Promise<{ body: PublishedKeychainPayload; keychain: LocalKeychain }> {
    const timestamp = Date.now();
    const version = Math.max(
      (session.keychain.version ?? 0) + 1,
      nextKeychain.version,
    );
    const keychain = { ...nextKeychain, version };
    const encryptedPayload = session.encryptedKeyPair
      .encrypt(new StringValueObject(JSON.stringify(keychain)))
      .toString();
    const signature = await session.encryptedKeyPair.sign(
      new StringValueObject(
        JSON.stringify({ encryptedPayload, timestamp, version }),
      ),
      new StringValueObject(session.password),
    );

    return {
      body: {
        encryptedPayload,
        previousKeychainExternalIdentifier:
          session.keychainExternalIdentifier ?? null,
        signature: signature.toString(),
        timestamp,
        version,
      },
      keychain,
    };
  }
}
