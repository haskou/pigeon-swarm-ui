import { GroupMessageHistoryStore } from './history/GroupMessageHistoryStore';
import { GroupMailboxInboxStore } from './inbox/GroupMailboxInboxStore';
import { GroupMailboxOutboxStore } from './outbox/GroupMailboxOutboxStore';

/**
 * The local stores of group conversations. History and the outbox are
 * shared by identities and keyed by identity; MLS state and generations live
 * in one database per identity, so forgetting an identity deletes them.
 */
export class GroupConversationStores {
  public readonly history: GroupMessageHistoryStore;
  public readonly inboxes = new GroupMailboxInboxStore();
  public readonly outbox: GroupMailboxOutboxStore;

  private static deleteDatabase(name: string): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(name);

      request.addEventListener('success', () => resolve());
      request.addEventListener('error', () => resolve());
      request.addEventListener('blocked', () => resolve());
    });
  }

  public constructor(private readonly storage: string) {
    this.history = new GroupMessageHistoryStore(`${storage}-history`);
    this.outbox = new GroupMailboxOutboxStore(`${storage}-outbox`);
  }

  public database(kind: 'generations' | 'mls', identityId: string): string {
    return `${this.storage}-${kind}-${identityId}`;
  }

  /** Deletes one identity's group state on this device. Never throws. */
  public async forget(identityId: string): Promise<void> {
    await Promise.all([
      this.history.forget(identityId),
      this.outbox.forget(identityId).catch(() => undefined),
      GroupConversationStores.deleteDatabase(this.database('mls', identityId)),
      GroupConversationStores.deleteDatabase(
        this.database('generations', identityId),
      ),
    ]);
  }
}
