import type { PrivateKeyPackage } from 'ts-mls';

import type { StoredMlsKeyPackage } from './StoredMlsKeyPackage';

/**
 * Device-local persistence. Nothing here may be synced: group state and key
 * package secrets are what keep the other members' past messages private.
 */
export interface MlsStateStore {
  deleteKeyPackage(id: string): Promise<void>;
  loadGroup(groupId: string): Promise<Uint8Array | undefined>;
  loadKeyPackages(): Promise<StoredMlsKeyPackage<PrivateKeyPackage>[]>;
  loadPlaintext(
    groupId: string,
    ciphertextId: string,
  ): Promise<string | undefined>;
  saveGroup(groupId: string, state: Uint8Array): Promise<void>;
  saveKeyPackage(
    keyPackage: StoredMlsKeyPackage<PrivateKeyPackage>,
  ): Promise<void>;
  /** Plaintext must outlive the ratchet: a message decrypts only once. */
  savePlaintext(
    groupId: string,
    ciphertextId: string,
    plaintext: string,
  ): Promise<void>;
}
