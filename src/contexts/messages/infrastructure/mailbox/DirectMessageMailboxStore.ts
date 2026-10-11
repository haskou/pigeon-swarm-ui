import {
  readJsonObjectFromLocalStorage,
  writeJsonToLocalStorage,
} from '../../../../shared/infrastructure/storage/jsonLocalStorage';
import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';

export type DirectMessageMailboxState = {
  /** Highest cursor acknowledged to the node. */
  cursor: number;
  readToken: string;
};

/** Read capability and acknowledged cursor per inbox, kept in scoped client storage. */
export class DirectMessageMailboxStore {
  private static readonly KEY_PREFIX = 'pigeon.direct-mailbox.';

  public load(mailboxId: string): DirectMessageMailboxState | null {
    const key = scopeClientStorageKey(
      `${DirectMessageMailboxStore.KEY_PREFIX}${mailboxId}`,
    );
    const stored = readJsonObjectFromLocalStorage<
      Partial<DirectMessageMailboxState>
    >(key, {});

    if (
      typeof stored.cursor !== 'number' ||
      typeof stored.readToken !== 'string'
    ) {
      return null;
    }

    return { cursor: stored.cursor, readToken: stored.readToken };
  }

  public save(mailboxId: string, state: DirectMessageMailboxState): void {
    writeJsonToLocalStorage(
      scopeClientStorageKey(
        `${DirectMessageMailboxStore.KEY_PREFIX}${mailboxId}`,
      ),
      state,
    );
  }
}
