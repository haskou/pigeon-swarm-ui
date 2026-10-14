import { Buffer } from 'buffer';

import type { Session } from '../../../identities/infrastructure/session/Session';

import {
  indexedDbRequest,
  indexedDbTransaction,
} from '../../../../shared/infrastructure/storage/indexedDbRequest';
import { sessionRootKey } from '../../../identities/infrastructure/session/sessionRootKey';
import { DeviceRootRowKeys } from './DeviceRootRowKeys';

const DATABASE_VERSION = 2;
const ENTRIES = 'entries';
const CANARIES = 'canaries';
const ID_LENGTH_BYTES = 4;

/**
 * Entries of each identity, by kind and id, sealed with AES-256-GCM under a
 * key derived from the device-sealed root and the store label. An entry is
 * kept under an HMAC-SHA256 tag of its kind and id, with its identity, kind
 * and tag as AAD, so no id or value is readable at rest and a value moved to
 * another entry does not open. The id is sealed with the value.
 *
 * A canary per identity tells whether the rows were sealed under the
 * session's root. When it opens only under the root the session replaced,
 * as after a device revoke, the rows are re-sealed under the current root in
 * one transaction. When it opens under neither, the identity's rows are
 * dropped. A root this store re-sealed away from is refused, so a stale
 * session never drops newer rows. Every call rejects without a device-sealed
 * root. Opening the database drops the tables of an earlier version, so
 * state stored before sealing is never read.
 */
export class DeviceSealedEntryStore {
  private connection: Promise<IDBDatabase> | undefined;
  private readonly replaced = new Map<string, Buffer[]>();
  private readonly scopes = new Map<
    string,
    { keys: Promise<DeviceRootRowKeys>; root: Buffer }
  >();

  private static aad(
    identityId: string,
    kind: string,
    tag: string,
  ): Uint8Array<ArrayBuffer> {
    return new TextEncoder().encode(
      JSON.stringify(['entry', identityId, kind, tag]),
    );
  }

  /** The id, its UTF-8 length first, then the value. */
  private static frame(id: string, value: Uint8Array): Uint8Array {
    const idBytes = new TextEncoder().encode(id);
    const framed = new Uint8Array(
      ID_LENGTH_BYTES + idBytes.byteLength + value.byteLength,
    );

    new DataView(framed.buffer).setUint32(0, idBytes.byteLength);
    framed.set(idBytes, ID_LENGTH_BYTES);
    framed.set(value, ID_LENGTH_BYTES + idBytes.byteLength);

    return framed;
  }

  private static identityRange(identityId: string): IDBKeyRange {
    return IDBKeyRange.bound([identityId], [identityId, []]);
  }

  private static unframe(framed: Uint8Array): {
    id: string;
    value: Uint8Array;
  } {
    const length = new DataView(
      framed.buffer,
      framed.byteOffset,
      framed.byteLength,
    ).getUint32(0);
    const valueAt = ID_LENGTH_BYTES + length;

    return {
      id: new TextDecoder().decode(framed.subarray(ID_LENGTH_BYTES, valueAt)),
      value: framed.slice(valueAt),
    };
  }

  /** `label` names the store and keys its derivation: `pigeon-mls-state`. */
  public constructor(
    private readonly databaseName: string,
    private readonly label: string,
  ) {}

  private async connect(): Promise<IDBDatabase> {
    const opening = indexedDB.open(this.databaseName, DATABASE_VERSION);

    opening.addEventListener('upgradeneeded', () => {
      const database = opening.result;

      for (const name of [...database.objectStoreNames]) {
        database.deleteObjectStore(name);
      }
      database.createObjectStore(ENTRIES);
      database.createObjectStore(CANARIES);
    });

    try {
      const database = await indexedDbRequest(opening);

      // A delete or an upgrade elsewhere waits on this connection.
      database.addEventListener('versionchange', () => {
        database.close();
        this.connection = undefined;
        this.scopes.clear();
        this.replaced.clear();
      });

      return database;
    } catch (error) {
      this.connection = undefined;
      throw error;
    }
  }

  private open(): Promise<IDBDatabase> {
    this.connection ??= this.connect();

    return this.connection;
  }

  private async canary(
    identityId: string,
  ): Promise<Uint8Array<ArrayBuffer> | undefined> {
    const transaction = (await this.open()).transaction(CANARIES, 'readonly');

    return await indexedDbRequest<Uint8Array<ArrayBuffer> | undefined>(
      transaction.objectStore(CANARIES).get(identityId),
    );
  }

  private async rows(
    range: IDBKeyRange,
  ): Promise<{ key: string[]; sealed: Uint8Array<ArrayBuffer> }[]> {
    const transaction = (await this.open()).transaction(ENTRIES, 'readonly');
    const entries = transaction.objectStore(ENTRIES);
    const [keys, values] = await Promise.all([
      indexedDbRequest(entries.getAllKeys(range)),
      indexedDbRequest<Uint8Array<ArrayBuffer>[]>(entries.getAll(range)),
    ]);

    return keys.map((key, index) => ({
      key: key as string[],
      sealed: values[index],
    }));
  }

  /** Drops the identity's rows and starts over under `canary`. */
  private async reset(
    identityId: string,
    canary: Uint8Array<ArrayBuffer>,
  ): Promise<void> {
    const transaction = (await this.open()).transaction(
      [ENTRIES, CANARIES],
      'readwrite',
    );

    transaction
      .objectStore(ENTRIES)
      .delete(DeviceSealedEntryStore.identityRange(identityId));
    transaction.objectStore(CANARIES).put(canary, identityId);
    await indexedDbTransaction(transaction);
  }

  /**
   * Re-seals every row of the identity from the keys of the replaced root
   * under the current ones, then swaps them in one transaction, only while
   * the canary is still the one that opened. A row that does not open is
   * dropped. A failure leaves the rows as they were.
   */
  private async reseal(
    identityId: string,
    replaced: DeviceRootRowKeys,
    current: DeviceRootRowKeys,
    canary: Uint8Array<ArrayBuffer>,
  ): Promise<void> {
    const resealed: { key: string[]; sealed: Uint8Array<ArrayBuffer> }[] = [];

    for (const { key, sealed } of await this.rows(
      DeviceSealedEntryStore.identityRange(identityId),
    )) {
      const [, kind, tag] = key;
      const framed = await replaced.cipher.open(
        DeviceSealedEntryStore.aad(identityId, kind, tag),
        sealed,
      );

      if (!framed) continue;
      const next = await current.tag([
        kind,
        DeviceSealedEntryStore.unframe(framed).id,
      ]);

      resealed.push({
        key: [identityId, kind, next],
        sealed: await current.cipher.seal(
          DeviceSealedEntryStore.aad(identityId, kind, next),
          framed,
        ),
      });
    }
    const nextCanary = await current.cipher.sealCanary();
    const transaction = (await this.open()).transaction(
      [ENTRIES, CANARIES],
      'readwrite',
    );
    const canaries = transaction.objectStore(CANARIES);
    const held = canaries.get(identityId);

    held.addEventListener('success', () => {
      if (
        !ArrayBuffer.isView(held.result) ||
        !Buffer.from(
          held.result.buffer,
          held.result.byteOffset,
          held.result.byteLength,
        ).equals(
          Buffer.from(canary.buffer, canary.byteOffset, canary.byteLength),
        )
      ) {
        transaction.abort();

        return;
      }
      const entries = transaction.objectStore(ENTRIES);

      entries.delete(DeviceSealedEntryStore.identityRange(identityId));

      for (const { key, sealed } of resealed) entries.put(sealed, key);
      canaries.put(nextCanary, identityId);
    });
    await indexedDbTransaction(transaction);
    // eslint-disable-next-line no-console
    console.info(`Re-sealed ${resealed.length} local entries.`);
  }

  /** The keys of the session's root, once the rows are known to be under it. */
  private keys(session: Session): Promise<DeviceRootRowKeys> {
    const root = Buffer.from(sessionRootKey(session).getBuffer());
    const identityId = session.identity.id;
    const held = this.scopes.get(identityId);

    if (held?.root.equals(root)) return held.keys;

    if (this.replaced.get(identityId)?.some((stale) => stale.equals(root))) {
      return Promise.reject(new Error('Device sealed root was replaced.'));
    }
    const keys = this.verified(
      identityId,
      root,
      session.previousDeviceSealedRootKey?.getBuffer(),
    );
    const scope = { keys, root };

    this.scopes.set(identityId, scope);
    keys.catch(() => {
      if (this.scopes.get(identityId) === scope) this.scopes.delete(identityId);
    });

    return keys;
  }

  private async verified(
    identityId: string,
    root: Uint8Array,
    replacedRoot: Uint8Array | undefined,
  ): Promise<DeviceRootRowKeys> {
    const current = await DeviceRootRowKeys.derive(
      root,
      this.label,
      identityId,
    );
    const canary = await this.canary(identityId);

    if (canary && (await current.cipher.opensCanary(canary))) return current;

    if (canary && replacedRoot) {
      const replaced = await DeviceRootRowKeys.derive(
        replacedRoot,
        this.label,
        identityId,
      );

      if (await replaced.cipher.opensCanary(canary)) {
        await this.reseal(identityId, replaced, current, canary);
        this.replaced.set(identityId, [
          ...(this.replaced.get(identityId) ?? []),
          Buffer.from(replacedRoot),
        ]);

        return current;
      }
    }
    await this.reset(identityId, await current.cipher.sealCanary());

    return current;
  }

  /** Drops the keys held in memory and closes the database, for logout. */
  public close(): void {
    const connection = this.connection;

    this.connection = undefined;
    this.scopes.clear();
    this.replaced.clear();
    void connection
      ?.then((database) => database.close())
      .catch(() => undefined);
  }

  public async delete(
    session: Session,
    kind: string,
    id: string,
  ): Promise<void> {
    const keys = await this.keys(session);
    const tag = await keys.tag([kind, id]);
    const transaction = (await this.open()).transaction(ENTRIES, 'readwrite');

    transaction.objectStore(ENTRIES).delete([session.identity.id, kind, tag]);
    await indexedDbTransaction(transaction);
  }

  /** Drops the identity's rows and canary. Rejects when they remain. */
  public async forget(identityId: string): Promise<void> {
    this.scopes.delete(identityId);
    this.replaced.delete(identityId);
    const transaction = (await this.open()).transaction(
      [ENTRIES, CANARIES],
      'readwrite',
    );

    transaction
      .objectStore(ENTRIES)
      .delete(DeviceSealedEntryStore.identityRange(identityId));
    transaction.objectStore(CANARIES).delete(identityId);
    await indexedDbTransaction(transaction);
  }

  /** The value, or undefined when absent or when it does not open. */
  public async get(
    session: Session,
    kind: string,
    id: string,
  ): Promise<Uint8Array | undefined> {
    const identityId = session.identity.id;
    const keys = await this.keys(session);
    const tag = await keys.tag([kind, id]);
    const transaction = (await this.open()).transaction(ENTRIES, 'readonly');
    const sealed = await indexedDbRequest<Uint8Array<ArrayBuffer> | undefined>(
      transaction.objectStore(ENTRIES).get([identityId, kind, tag]),
    );

    if (!sealed) return undefined;
    const framed = await keys.cipher.open(
      DeviceSealedEntryStore.aad(identityId, kind, tag),
      sealed,
    );

    if (!framed) return undefined;
    const entry = DeviceSealedEntryStore.unframe(framed);

    return entry.id === id ? entry.value : undefined;
  }

  /** Every entry of one kind that opens, in no particular order. */
  public async list(
    session: Session,
    kind: string,
  ): Promise<{ id: string; value: Uint8Array }[]> {
    const identityId = session.identity.id;
    const keys = await this.keys(session);
    const opened: { id: string; value: Uint8Array }[] = [];

    for (const { key, sealed } of await this.rows(
      IDBKeyRange.bound([identityId, kind], [identityId, kind, []]),
    )) {
      const framed = await keys.cipher.open(
        DeviceSealedEntryStore.aad(identityId, kind, key[2]),
        sealed,
      );

      if (framed) opened.push(DeviceSealedEntryStore.unframe(framed));
    }

    return opened;
  }

  public async put(
    session: Session,
    kind: string,
    id: string,
    value: Uint8Array,
  ): Promise<void> {
    const identityId = session.identity.id;
    const keys = await this.keys(session);
    const tag = await keys.tag([kind, id]);
    const sealed = await keys.cipher.seal(
      DeviceSealedEntryStore.aad(identityId, kind, tag),
      DeviceSealedEntryStore.frame(id, value),
    );
    const transaction = (await this.open()).transaction(ENTRIES, 'readwrite');

    transaction.objectStore(ENTRIES).put(sealed, [identityId, kind, tag]);
    await indexedDbTransaction(transaction);
  }
}
