import type { PrivateKeyPackage } from 'ts-mls';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DeviceSealedEntryStore } from '../../../messages/infrastructure/mailbox/DeviceSealedEntryStore';
import type { MlsStateStore } from './MlsStateStore';
import type { StoredMlsKeyPackage } from './StoredMlsKeyPackage';

import {
  decodeBase64Url,
  encodeBase64Url,
} from '../../../../shared/infrastructure/encoding/base64url';

/**
 * MLS group state, key package secrets and decrypted plaintexts of the
 * session's identity on this device, sealed under the device-sealed root
 * (`DeviceSealedEntryStore`). The database is never synced or shared. The
 * latest opened plaintexts stay in memory, so reopening a conversation opens
 * nothing again.
 */
export class IndexedDbMlsStateStore implements MlsStateStore {
  private static readonly HELD_PLAINTEXTS = 2048;

  private readonly plaintexts = new Map<string, string>();

  public constructor(
    private readonly entries: DeviceSealedEntryStore,
    private readonly session: () => Session,
  ) {}

  /** Holds the plaintext as the latest, dropping the oldest past the cap. */
  private hold(key: string, plaintext: string): void {
    this.plaintexts.delete(key);
    this.plaintexts.set(key, plaintext);

    if (this.plaintexts.size > IndexedDbMlsStateStore.HELD_PLAINTEXTS) {
      this.plaintexts.delete(this.plaintexts.keys().next().value as string);
    }
  }

  public async deleteKeyPackage(id: string): Promise<void> {
    await this.entries.delete(this.session(), 'key-package', id);
  }

  public async loadGroup(groupId: string): Promise<Uint8Array | undefined> {
    return await this.entries.get(this.session(), 'group', groupId);
  }

  public async loadKeyPackages(): Promise<
    StoredMlsKeyPackage<PrivateKeyPackage>[]
  > {
    const stored = await this.entries.list(this.session(), 'key-package');

    return stored.map(({ id, value }) => {
      const parts = JSON.parse(new TextDecoder().decode(value)) as Record<
        string,
        string
      >;
      const bytes = (field: string) =>
        new Uint8Array(decodeBase64Url(parts[field]));

      return {
        // Packages stored before groups had their own pools name none.
        groupId: parts.groupId as string | undefined,
        id,
        privatePackage: {
          hpkePrivateKey: bytes('hpkePrivateKey'),
          initPrivateKey: bytes('initPrivateKey'),
          signaturePrivateKey: bytes('signaturePrivateKey'),
        },
        publicBytes: bytes('publicBytes'),
      };
    });
  }

  public async loadPlaintext(
    groupId: string,
    ciphertextId: string,
  ): Promise<string | undefined> {
    const key = JSON.stringify([groupId, ciphertextId]);
    const held = this.plaintexts.get(key);

    if (held !== undefined) {
      this.hold(key, held);

      return held;
    }
    const stored = await this.entries.get(this.session(), 'plaintext', key);

    if (!stored) return undefined;
    const plaintext = new TextDecoder().decode(stored);

    this.hold(key, plaintext);

    return plaintext;
  }

  public async saveGroup(groupId: string, state: Uint8Array): Promise<void> {
    await this.entries.put(this.session(), 'group', groupId, state);
  }

  public async saveKeyPackage({
    groupId,
    id,
    privatePackage,
    publicBytes,
  }: StoredMlsKeyPackage<PrivateKeyPackage>): Promise<void> {
    await this.entries.put(
      this.session(),
      'key-package',
      id,
      new TextEncoder().encode(
        JSON.stringify({
          groupId,
          hpkePrivateKey: encodeBase64Url(privatePackage.hpkePrivateKey),
          initPrivateKey: encodeBase64Url(privatePackage.initPrivateKey),
          publicBytes: encodeBase64Url(publicBytes),
          signaturePrivateKey: encodeBase64Url(
            privatePackage.signaturePrivateKey,
          ),
        }),
      ),
    );
  }

  public async savePlaintext(
    groupId: string,
    ciphertextId: string,
    plaintext: string,
  ): Promise<void> {
    const key = JSON.stringify([groupId, ciphertextId]);

    await this.entries.put(
      this.session(),
      'plaintext',
      key,
      new TextEncoder().encode(plaintext),
    );
    this.hold(key, plaintext);
  }
}
