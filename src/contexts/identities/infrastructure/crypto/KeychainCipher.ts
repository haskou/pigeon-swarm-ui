import { EncryptedPayload } from '@haskou/pigeon-swarm-crypto';

import type { KeychainResource } from '../http/resources/KeychainResource';
import type { LocalKeychain } from '../keychain/LocalKeychain';
import type { Session } from '../session/Session';
import type { KeychainDomainSignaturePayload } from './KeychainDomainSignaturePayload';
import type { PublishedKeychainPayload } from './PublishedKeychainPayload';

import { signSessionPayload } from '../../../../shared/infrastructure/crypto/signSessionPayload';
import { IdentityId } from '../../domain/value-objects/IdentityId';
import { sessionRootKey } from '../session/sessionRootKey';

export type KeychainHead = {
  keychain: LocalKeychain;
  keychainExternalIdentifier: string;
};

export class KeychainCipher {
  /**
   * Opens under the device-sealed root. A head sealed under the master key
   * before the root existed opens through this fallback until unlock reseals
   * it under the root.
   */
  private open(session: Session, payload: EncryptedPayload): string {
    try {
      return sessionRootKey(session).decrypt(payload).toString();
    } catch (error: unknown) {
      if (!session.deviceSealedRootKey) {
        throw error;
      }

      return session.masterKey.decrypt(payload).toString();
    }
  }

  public decrypt(session: Session, keychain: KeychainResource): LocalKeychain {
    const decrypted = this.open(
      session,
      new EncryptedPayload(keychain.encryptedPayload),
    );

    const parsed = JSON.parse(decrypted.toString()) as Partial<LocalKeychain>;

    return {
      conversations: parsed.conversations ?? {},
      timestamp: parsed.timestamp ?? keychain.timestamp,
      version: parsed.version ?? keychain.version ?? 0,
    };
  }

  /**
   * True when the head opens under the session's root alone. Never falls back
   * to the master key.
   */
  public isSealedUnderRoot(
    session: Session,
    keychain: KeychainResource,
  ): boolean {
    try {
      sessionRootKey(session).decrypt(
        new EncryptedPayload(keychain.encryptedPayload),
      );

      return true;
    } catch {
      return false;
    }
  }

  public async encryptForPublish(
    session: Session,
    head: KeychainHead | undefined,
    nextKeychain: LocalKeychain,
  ): Promise<{ body: PublishedKeychainPayload; keychain: LocalKeychain }> {
    const timestamp = Date.now();
    const version = (head?.keychain.version ?? 0) + 1;
    const keychain = { ...nextKeychain, timestamp, version };
    const encryptedPayload = sessionRootKey(session)
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
