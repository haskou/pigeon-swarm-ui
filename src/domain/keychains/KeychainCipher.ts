import { EncryptedPayload } from '@haskou/value-objects';

import type { KeychainResource, LocalKeychain, Session } from '../types';

import { normalizeIdentityId } from '../../utils/identityId';

type PublishedKeychainPayload = {
  encryptedPayload: string;
  previousKeychainExternalIdentifier: null | string;
  signature: string;
  timestamp: number;
  version: number;
};

type KeychainDomainSignaturePayload = {
  encryptedPayload: string;
  ownerIdentityId: string;
  previousKeychainExternalIdentifier?: string;
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
      session.password,
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
      .encrypt(JSON.stringify(keychain))
      .toString();
    const previousKeychainExternalIdentifier =
      session.keychainExternalIdentifier ?? undefined;
    const domainPayload: KeychainDomainSignaturePayload = {
      encryptedPayload,
      ownerIdentityId: normalizeIdentityId(session.identity.id),
      previousKeychainExternalIdentifier,
      timestamp,
      version,
    };
    const signature = await session.encryptedKeyPair.sign(
      JSON.stringify(domainPayload),
      session.password,
    );

    return {
      body: {
        encryptedPayload,
        previousKeychainExternalIdentifier:
          previousKeychainExternalIdentifier ?? null,
        signature: signature.toString(),
        timestamp,
        version,
      },
      keychain,
    };
  }
}
