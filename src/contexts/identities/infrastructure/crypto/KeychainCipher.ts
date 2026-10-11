import { EncryptedPayload } from '@haskou/pigeon-swarm-crypto';

import type {
  KeychainResource,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { KeychainDomainSignaturePayload } from './KeychainDomainSignaturePayload';
import type { PublishedKeychainPayload } from './PublishedKeychainPayload';

import { signSessionPayload } from '../../../../shared/infrastructure/crypto/signSessionPayload';
import { IdentityId } from '../../domain/value-objects/IdentityId';

export type KeychainHead = {
  keychain: LocalKeychain;
  keychainExternalIdentifier: string;
};

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
    head: KeychainHead | undefined,
    nextKeychain: LocalKeychain,
  ): Promise<{ body: PublishedKeychainPayload; keychain: LocalKeychain }> {
    const timestamp = Date.now();
    const version = (head?.keychain.version ?? 0) + 1;
    const keychain = { ...nextKeychain, timestamp, version };
    const encryptedPayload = session.masterKey
      .encrypt(JSON.stringify(keychain))
      .toString();
    const previousKeychainExternalIdentifier = head?.keychainExternalIdentifier;
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
