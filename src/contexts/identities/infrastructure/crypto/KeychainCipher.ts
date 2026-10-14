import {
  EncryptedPayload,
  type SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';

import type { KeychainResource } from '../http/resources/KeychainResource';
import type { LocalKeychain } from '../keychain/LocalKeychain';
import type { Session } from '../session/Session';
import type { KeychainDomainSignaturePayload } from './KeychainDomainSignaturePayload';
import type { PublishedKeychainPayload } from './PublishedKeychainPayload';

import { signSessionPayload } from '../../../../shared/infrastructure/crypto/signSessionPayload';
import { IdentityId } from '../../domain/value-objects/IdentityId';
import { KeychainVersion } from '../../domain/value-objects/KeychainVersion';

export type KeychainHead = {
  keychain: LocalKeychain;
  keychainExternalIdentifier: string;
};

export class KeychainCipher {
  /**
   * The device-sealed root is the only key that opens or seals a keychain
   * head. A session without a root can neither read nor publish one.
   */
  private root(session: Session): SymmetricKey {
    if (!session.deviceSealedRootKey) {
      throw new Error('Device sealed root is not open.');
    }

    return session.deviceSealedRootKey;
  }

  public decrypt(session: Session, keychain: KeychainResource): LocalKeychain {
    const decrypted = this.root(session).decrypt(
      new EncryptedPayload(keychain.encryptedPayload),
    );

    const parsed = JSON.parse(decrypted.toString()) as Partial<LocalKeychain>;

    return {
      conversations: parsed.conversations ?? {},
      timestamp: parsed.timestamp ?? keychain.timestamp,
      version: KeychainVersion.fromNumber(
        parsed.version ?? keychain.version ?? 0,
      ).valueOf(),
    };
  }

  /**
   * True when the head opens under the session's device-sealed root. False
   * when no root is held.
   */
  public isSealedUnderRoot(
    session: Session,
    keychain: KeychainResource,
  ): boolean {
    try {
      this.root(session).decrypt(
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
    const encryptedPayload = this.root(session)
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
