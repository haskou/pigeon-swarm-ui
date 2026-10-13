import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import {
  readJsonObjectFromLocalStorage,
  writeJsonToLocalStorage,
} from '../../../../shared/infrastructure/storage/jsonLocalStorage';

/**
 * Per-device state of this identity's group inboxes, keyed by inbox id: the
 * acknowledged cursor, and whether a drained inbox was deleted. Without
 * local storage it keeps nothing; reads then restart from the oldest
 * unacknowledged envelope.
 */
export class GroupMailboxInboxStore {
  private static readonly CURSOR_PREFIX = 'pigeon.group-mailbox.';
  private static readonly DELETED_PREFIX = 'pigeon.group-mailbox-deleted.';

  public cursor(mailboxId: string): number {
    const stored = readJsonObjectFromLocalStorage<{ cursor?: unknown }>(
      scopeClientStorageKey(
        `${GroupMailboxInboxStore.CURSOR_PREFIX}${mailboxId}`,
      ),
      {},
    );

    return typeof stored.cursor === 'number' ? stored.cursor : 0;
  }

  public isDeleted(mailboxId: string): boolean {
    return (
      readJsonObjectFromLocalStorage<{ deleted?: unknown }>(
        scopeClientStorageKey(
          `${GroupMailboxInboxStore.DELETED_PREFIX}${mailboxId}`,
        ),
        {},
      ).deleted === true
    );
  }

  public markDeleted(mailboxId: string): void {
    writeJsonToLocalStorage(
      scopeClientStorageKey(
        `${GroupMailboxInboxStore.DELETED_PREFIX}${mailboxId}`,
      ),
      { deleted: true },
    );
  }

  public saveCursor(mailboxId: string, cursor: number): void {
    writeJsonToLocalStorage(
      scopeClientStorageKey(
        `${GroupMailboxInboxStore.CURSOR_PREFIX}${mailboxId}`,
      ),
      { cursor },
    );
  }
}
