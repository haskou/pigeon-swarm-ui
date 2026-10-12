import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import {
  readJsonObjectFromLocalStorage,
  writeJsonToLocalStorage,
} from '../../../../shared/infrastructure/storage/jsonLocalStorage';

export type DirectMessageMailboxState = {
  /** Highest cursor acknowledged to the node. */
  cursor: number;
  /**
   * Legacy only: inboxes created before the token was derived from the root
   * key keep their random read token here. New inboxes store none.
   */
  readToken?: string;
};

/**
 * Read capability and acknowledged cursor per inbox, kept in scoped client
 * storage.
 */
export class DirectMessageMailboxStore {
  private static readonly KEY_PREFIX = 'pigeon.direct-mailbox.';

  public load(mailboxId: string): DirectMessageMailboxState | null {
    const key = scopeClientStorageKey(
      `${DirectMessageMailboxStore.KEY_PREFIX}${mailboxId}`,
    );
    const stored = readJsonObjectFromLocalStorage<
      Partial<DirectMessageMailboxState>
    >(key, {});

    if (typeof stored.cursor !== 'number') return null;

    return typeof stored.readToken === 'string'
      ? { cursor: stored.cursor, readToken: stored.readToken }
      : { cursor: stored.cursor };
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
