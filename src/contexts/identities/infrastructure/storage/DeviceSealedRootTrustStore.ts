import type { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';

import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';
import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';

const storagePrefix = 'pigeon-swarm:device-sealed-root-trust:v1';
const fingerprintLabel = utf8ToBytes('pigeon-swarm/device-sealed-root-trust');

/**
 * Remembers, per local identity on this device, the one device-sealed root
 * this device last opened from an entry whose publisher the signed
 * transitions authorized, or published itself. Only a fingerprint keyed by
 * the local vault key is kept, so the record reveals nothing about the root
 * and a record planted without that key matches nothing. Reads never throw:
 * unreadable data trusts nothing. Writes throw when the browser refuses them.
 */
export class DeviceSealedRootTrustStore {
  private static fingerprint(
    identityId: string,
    localKey: SymmetricKey,
    root: SymmetricKey,
  ): string {
    return encodeBase64Url(
      hmac(
        sha256,
        localKey.getBuffer(),
        concatBytes(
          fingerprintLabel,
          utf8ToBytes(`:${identityId}:`),
          root.getBuffer(),
        ),
      ),
    );
  }

  public constructor(
    private readonly storage: Pick<
      Storage,
      'getItem' | 'removeItem' | 'setItem'
    >,
  ) {}

  private key(identityId: string): string {
    return scopeClientStorageKey(`${storagePrefix}:${identityId}`);
  }

  public remember(
    identityId: string,
    localKey: SymmetricKey,
    root: SymmetricKey,
  ): void {
    this.storage.setItem(
      this.key(identityId),
      DeviceSealedRootTrustStore.fingerprint(identityId, localKey, root),
    );
  }

  /**
   * Whether the root is the one remembered for the identity. Compared in
   * plain: the fingerprint is keyed and the comparison runs on this device.
   */
  public trusts(
    identityId: string,
    localKey: SymmetricKey,
    root: SymmetricKey,
  ): boolean {
    let kept: string | null;

    try {
      kept = this.storage.getItem(this.key(identityId));
    } catch {
      return false;
    }

    return (
      kept !== null &&
      kept ===
        DeviceSealedRootTrustStore.fingerprint(identityId, localKey, root)
    );
  }

  public forget(identityId: string): void {
    this.storage.removeItem(this.key(identityId));
  }
}
