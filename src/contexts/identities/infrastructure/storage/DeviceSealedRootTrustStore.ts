import type { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import { hkdf } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';

import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';
import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';

const storagePrefix = 'pigeon-swarm:device-sealed-root-trust:v2';
const fingerprintLabel = utf8ToBytes('pigeon-swarm/device-sealed-root-trust');
const subkeyInfo = utf8ToBytes('pigeon-swarm/device-sealed-root-trust/v2');
const subkeyLength = 32;
const recordPattern = /^(0|[1-9]\d*)\.([\w-]+)$/;

/**
 * Remembers, per local identity on this device, the one device-sealed root
 * this device last opened from an entry whose publisher the signed
 * transitions authorized, or published itself, with the authorization
 * revision of that entry. Only a fingerprint is kept, keyed by a subkey
 * derived from the vault root key, never by that key itself. That key is the
 * identity root every paired device shares, not a key of this device alone:
 * the record reveals nothing about the root, and a record planted without
 * that key matches nothing. Reads never throw: unreadable or unparseable
 * data, including a record of an earlier version, trusts nothing and
 * supersedes nothing. Writes throw when the browser refuses them.
 */
export class DeviceSealedRootTrustStore {
  private static fingerprint(
    identityId: string,
    vaultRootKey: SymmetricKey,
    root: SymmetricKey,
    revision: number,
  ): string {
    return encodeBase64Url(
      hmac(
        sha256,
        hkdf(
          sha256,
          vaultRootKey.getBuffer(),
          undefined,
          subkeyInfo,
          subkeyLength,
        ),
        concatBytes(
          fingerprintLabel,
          utf8ToBytes(`:${identityId}:${revision}:`),
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

  private kept(
    identityId: string,
  ): { fingerprint: string; revision: number } | null {
    let kept: string | null;

    try {
      kept = this.storage.getItem(this.key(identityId));
    } catch {
      return null;
    }

    const match = kept === null ? null : recordPattern.exec(kept);
    const revision = match ? Number(match[1]) : Number.NaN;

    return match && Number.isSafeInteger(revision)
      ? { fingerprint: match[2], revision }
      : null;
  }

  public remember(
    identityId: string,
    vaultRootKey: SymmetricKey,
    root: SymmetricKey,
    revision: number,
  ): void {
    this.storage.setItem(
      this.key(identityId),
      `${revision}.${DeviceSealedRootTrustStore.fingerprint(
        identityId,
        vaultRootKey,
        root,
        revision,
      )}`,
    );
  }

  /**
   * Whether the root is the one remembered for the identity. Compared in
   * plain: the fingerprint is keyed and the comparison runs on this device.
   */
  public trusts(
    identityId: string,
    vaultRootKey: SymmetricKey,
    root: SymmetricKey,
  ): boolean {
    const kept = this.kept(identityId);

    return (
      kept !== null &&
      kept.fingerprint ===
        DeviceSealedRootTrustStore.fingerprint(
          identityId,
          vaultRootKey,
          root,
          kept.revision,
        )
    );
  }

  /**
   * Whether another root is remembered for the identity at the given
   * revision or above, so an entry taking this root there comes too late.
   */
  public supersedes(
    identityId: string,
    vaultRootKey: SymmetricKey,
    root: SymmetricKey,
    revision: number,
  ): boolean {
    const kept = this.kept(identityId);

    return (
      kept !== null &&
      kept.revision >= revision &&
      !this.trusts(identityId, vaultRootKey, root)
    );
  }

  public forget(identityId: string): void {
    this.storage.removeItem(this.key(identityId));
  }
}
