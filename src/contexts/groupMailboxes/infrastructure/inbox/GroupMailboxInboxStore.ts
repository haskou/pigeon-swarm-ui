import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import {
  readJsonObjectFromLocalStorage,
  writeJsonToLocalStorage,
} from '../../../../shared/infrastructure/storage/jsonLocalStorage';

/**
 * Per-device state of this identity's group inboxes, keyed by inbox id: the
 * acknowledged cursor, whether a drained inbox was deleted, and how often
 * the envelope at the head of the inbox failed to open. Only one envelope
 * per inbox fails at a time, since a failure stops the read there. Without
 * local storage it keeps nothing; reads then restart from the oldest
 * unacknowledged envelope.
 */
export class GroupMailboxInboxStore {
  private static readonly CURSOR_PREFIX = 'pigeon.group-mailbox.';
  private static readonly DELETED_PREFIX = 'pigeon.group-mailbox-deleted.';
  private static readonly FAILURES_PREFIX = 'pigeon.group-mailbox-failures.';

  public cursor(mailboxId: string): number {
    const stored = readJsonObjectFromLocalStorage<{ cursor?: unknown }>(
      scopeClientStorageKey(
        `${GroupMailboxInboxStore.CURSOR_PREFIX}${mailboxId}`,
      ),
      {},
    );

    return typeof stored.cursor === 'number' ? stored.cursor : 0;
  }

  /** How often `envelopeId` of the inbox failed to open so far. */
  public failures(mailboxId: string, envelopeId: string): number {
    const stored = readJsonObjectFromLocalStorage<{
      envelopeId?: unknown;
      failures?: unknown;
    }>(
      scopeClientStorageKey(
        `${GroupMailboxInboxStore.FAILURES_PREFIX}${mailboxId}`,
      ),
      {},
    );

    return stored.envelopeId === envelopeId &&
      typeof stored.failures === 'number'
      ? stored.failures
      : 0;
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

  public saveFailures(
    mailboxId: string,
    envelopeId: string,
    failures: number,
  ): void {
    writeJsonToLocalStorage(
      scopeClientStorageKey(
        `${GroupMailboxInboxStore.FAILURES_PREFIX}${mailboxId}`,
      ),
      { envelopeId, failures },
    );
  }
}
