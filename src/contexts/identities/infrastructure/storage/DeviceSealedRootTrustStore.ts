import type { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import { hkdf } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';

import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';
import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';

const storagePrefix = 'pigeon-swarm:device-sealed-root-trust';
const storageVersion = 'v3';
const earlierStorageVersions = ['v1', 'v2'] as const;
const fingerprintLabel = 'pigeon-swarm/device-sealed-root-trust';
const subkeyInfo = utf8ToBytes('pigeon-swarm/device-sealed-root-trust/v3');
const subkeyLength = 32;
const recordPattern = /^(0|[1-9]\d*)\.([\w-]+)\.([\w-]+)$/;

/**
 * Remembers, per local identity on this device, the one device-sealed root
 * this device last opened from an entry whose publisher the signed
 * transitions authorized, or published itself, with the highest
 * authorization revision this device reached with a trusted root. That
 * revision never lowers, so a node that rolls an entry back cannot reopen a
 * hand-over below it. Only a fingerprint of the root is kept, with a tag over
 * the revision, both keyed by a subkey derived from the vault root key, never
 * by that key itself. That key is the identity root every paired device
 * shares, not a key of this device alone: the record reveals nothing about
 * the root, and a record or revision planted without that key counts for
 * nothing. Reads never throw: unreadable, unparseable or unauthenticated
 * data trusts nothing and supersedes nothing. Records of earlier versions are
 * never read, and are removed when the identity's record is written or
 * forgotten. Writes throw when the browser refuses them.
 */
export class DeviceSealedRootTrustStore {
  private static mac(vaultRootKey: SymmetricKey, message: Uint8Array): string {
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
        message,
      ),
    );
  }

  private static revisionTag(
    identityId: string,
    vaultRootKey: SymmetricKey,
    revision: number,
  ): string {
    return this.mac(
      vaultRootKey,
      utf8ToBytes(`${fingerprintLabel}/revision:${identityId}:${revision}`),
    );
  }

  private static fingerprint(
    identityId: string,
    vaultRootKey: SymmetricKey,
    root: SymmetricKey,
    revision: number,
  ): string {
    return this.mac(
      vaultRootKey,
      concatBytes(
        utf8ToBytes(`${fingerprintLabel}:${identityId}:${revision}:`),
        root.getBuffer(),
      ),
    );
  }

  public constructor(
    private readonly storage: Pick<
      Storage,
      'getItem' | 'removeItem' | 'setItem'
    >,
  ) {}

  private key(identityId: string, version: string = storageVersion): string {
    return scopeClientStorageKey(`${storagePrefix}:${version}:${identityId}`);
  }

  private read(identityId: string): string | null {
    try {
      return this.storage.getItem(this.key(identityId));
    } catch {
      return null;
    }
  }

  /** The kept record once its revision tag authenticates; null otherwise. */
  private kept(
    identityId: string,
    vaultRootKey: SymmetricKey,
  ): { fingerprint: string; revision: number } | null {
    const record = this.read(identityId);
    const match = record === null ? null : recordPattern.exec(record);
    const revision = match ? Number(match[1]) : Number.NaN;

    return match &&
      Number.isSafeInteger(revision) &&
      match[2] ===
        DeviceSealedRootTrustStore.revisionTag(
          identityId,
          vaultRootKey,
          revision,
        )
      ? { fingerprint: match[3], revision }
      : null;
  }

  private removeEarlierVersions(identityId: string): void {
    for (const version of earlierStorageVersions) {
      this.storage.removeItem(this.key(identityId, version));
    }
  }

  /**
   * Keeps the root at the given revision, or at the kept one when that is
   * higher.
   */
  public remember(
    identityId: string,
    vaultRootKey: SymmetricKey,
    root: SymmetricKey,
    revision: number,
  ): void {
    const kept = Math.max(
      revision,
      this.kept(identityId, vaultRootKey)?.revision ?? revision,
    );

    this.storage.setItem(
      this.key(identityId),
      [
        kept,
        DeviceSealedRootTrustStore.revisionTag(identityId, vaultRootKey, kept),
        DeviceSealedRootTrustStore.fingerprint(
          identityId,
          vaultRootKey,
          root,
          kept,
        ),
      ].join('.'),
    );
    this.removeEarlierVersions(identityId);
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
    const kept = this.kept(identityId, vaultRootKey);

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
    const kept = this.kept(identityId, vaultRootKey);

    return (
      kept !== null &&
      kept.revision >= revision &&
      !this.trusts(identityId, vaultRootKey, root)
    );
  }

  public forget(identityId: string): void {
    this.storage.removeItem(this.key(identityId));
    this.removeEarlierVersions(identityId);
  }
}
