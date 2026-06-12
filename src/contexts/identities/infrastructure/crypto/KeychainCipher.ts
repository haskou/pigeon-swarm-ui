import { EncryptedPayload } from '@haskou/value-objects';

import type {
  KeychainResource,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { KeychainDomainSignaturePayload } from './KeychainDomainSignaturePayload';
import type { PublishedKeychainPayload } from './PublishedKeychainPayload';

import { signSessionPayload } from '../../../../shared/infrastructure/crypto/signSessionPayload';
import { IdentityId } from '../../domain/value-objects/IdentityId';

export class KeychainCipher {
  public decrypt(session: Session, keychain: KeychainResource): LocalKeychain {
    const decrypted = session.masterKey.decrypt(
      new EncryptedPayload(keychain.encryptedPayload),
    );

    const parsed = JSON.parse(decrypted.toString()) as Partial<LocalKeychain>;

    return {
      conversations: parsed.conversations ?? {},
      timestamp: parsed.timestamp ?? keychain.timestamp,
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
    const keychain = { ...nextKeychain, timestamp, version };
    const encryptedPayload = session.masterKey
      .encrypt(JSON.stringify(keychain))
      .toString();
    const previousKeychainExternalIdentifier =
      session.keychainExternalIdentifier ?? undefined;
    const domainPayload: KeychainDomainSignaturePayload = {
      encryptedPayload,
      ownerIdentityId: IdentityId.normalize(session.identity.id),
      previousKeychainExternalIdentifier,
      timestamp,
      version,
    };
    const signature = await signSessionPayload(
      session,
      JSON.stringify(domainPayload),
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
