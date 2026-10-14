import { GroupMessageHistoryStore } from './history/GroupMessageHistoryStore';
import { GroupMailboxInboxStore } from './inbox/GroupMailboxInboxStore';
import { GroupMailboxOutboxStore } from './outbox/GroupMailboxOutboxStore';

/**
 * The local stores of group conversations. History and the outbox are
 * shared by identities and keyed by identity; MLS state, generations and
 * the handled control letters live in one database per identity, so
 * forgetting an identity deletes them.
 */
export class GroupConversationStores {
  public readonly history: GroupMessageHistoryStore;
  public readonly inboxes = new GroupMailboxInboxStore();
  public readonly outbox: GroupMailboxOutboxStore;

  /**
   * Resolves once the database is gone. A blocked delete stays queued until
   * the open connections close, so it is not reported as done before that.
   */
  private static deleteDatabase(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);

      request.addEventListener('success', () => resolve());
      request.addEventListener('error', () => reject(request.error));
    });
  }

  public constructor(private readonly storage: string) {
    this.history = new GroupMessageHistoryStore(`${storage}-history`);
    this.outbox = new GroupMailboxOutboxStore(`${storage}-outbox`);
  }

  public database(
    kind: 'control' | 'generations' | 'mls',
    identityId: string,
  ): string {
    return `${this.storage}-${kind}-${identityId}`;
  }

  /**
   * Deletes one identity's group state on this device. Every store is tried;
   * rejects afterwards when any of them could not be deleted.
   */
  public async forget(identityId: string): Promise<void> {
    const results = await Promise.allSettled([
      this.history.forget(identityId),
      this.outbox.forget(identityId),
      GroupConversationStores.deleteDatabase(this.database('mls', identityId)),
      GroupConversationStores.deleteDatabase(
        this.database('control', identityId),
      ),
      GroupConversationStores.deleteDatabase(
        this.database('generations', identityId),
      ),
    ]);

    if (results.some(({ status }) => status === 'rejected')) {
      throw new Error('Group state could not be deleted.');
    }
  }
}
