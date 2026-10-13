import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import {
  readJsonObjectFromLocalStorage,
  writeJsonToLocalStorage,
} from '../../../../shared/infrastructure/storage/jsonLocalStorage';

export type DirectMessageMailboxState = {
  /** Highest cursor acknowledged to the node. */
  cursor: number;
};

/**
 * Read capability and acknowledged cursor per inbox, kept in scoped client
 * storage. Each availability server keeps its own cursor, so its store is
 * namespaced by the server base; the connected node uses no namespace.
 */
export class DirectMessageMailboxStore {
  private static readonly KEY_PREFIX = 'pigeon.direct-mailbox.';
  private static readonly READ_KEY_PREFIX = 'pigeon.direct-mailbox-read.';

  public constructor(private readonly namespace = '') {}

  private keyFor(prefix: string, mailboxId: string): string {
    return scopeClientStorageKey(
      this.namespace === ''
        ? `${prefix}${mailboxId}`
        : `${prefix}${this.namespace}:${mailboxId}`,
    );
  }

  public load(mailboxId: string): DirectMessageMailboxState | null {
    const stored = readJsonObjectFromLocalStorage<
      Partial<DirectMessageMailboxState>
    >(this.keyFor(DirectMessageMailboxStore.KEY_PREFIX, mailboxId), {});

    if (typeof stored.cursor !== 'number') return null;

    return { cursor: stored.cursor };
  }

  public save(mailboxId: string, state: DirectMessageMailboxState): void {
    writeJsonToLocalStorage(
      this.keyFor(DirectMessageMailboxStore.KEY_PREFIX, mailboxId),
      state,
    );
  }

  /**
   * Position of the background read pass. Stored apart from the sync cursor,
   * so that pass never moves the cursor that the node is acknowledged against.
   */
  public loadReadCursor(mailboxId: string): number | null {
    const stored = readJsonObjectFromLocalStorage<{ cursor?: unknown }>(
      this.keyFor(DirectMessageMailboxStore.READ_KEY_PREFIX, mailboxId),
      {},
    );

    return typeof stored.cursor === 'number' ? stored.cursor : null;
  }

  public saveReadCursor(mailboxId: string, cursor: number): void {
    writeJsonToLocalStorage(
      this.keyFor(DirectMessageMailboxStore.READ_KEY_PREFIX, mailboxId),
      { cursor },
    );
  }
}
