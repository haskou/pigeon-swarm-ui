import type { Session } from '../../../identities/infrastructure/session/Session';
import type { DirectMessageHistoryEntry } from './DirectMessageHistoryEntry';
import type { DirectMessageHistoryItem } from './DirectMessageHistoryItem';
import type { DirectMessageHistoryStore } from './DirectMessageHistoryStore';

import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { sessionRootKey } from '../../../identities/infrastructure/session/sessionRootKey';
import { DirectMailboxOwnership } from '../../../mailboxes/domain/DirectMailboxOwnership';
import { DirectMessageAuthorship } from './DirectMessageAuthorship';
import { DirectMessageMailboxRecord } from './DirectMessageMailboxRecord';

/**
 * Reads and writes the direct history carried by a backup file. Only stored
 * records travel: no mailbox, session or ratchet keys. The file itself is
 * authenticated under the identity root, so restored own records are tagged
 * again under the current device root, which may have rotated since.
 */
export class DirectMessageHistoryBackup {
  public constructor(private readonly history: DirectMessageHistoryStore) {}

  /** Every stored record, oldest first. Rejects when the store cannot read. */
  public async export(session: Session): Promise<DirectMessageHistoryItem[]> {
    return await this.history.all(session);
  }

  /** Stores the records, skipping invalid ones and records already here. */
  public async import(
    session: Session,
    items: DirectMessageHistoryItem[],
  ): Promise<void> {
    const rootKey = sessionRootKey(session).getBuffer();
    const owner = IdentityId.fromString(session.identity.id);
    const byConversation = new Map<string, DirectMessageHistoryEntry[]>();

    for (const { conversationId, plaintext } of items) {
      const record = DirectMessageMailboxRecord.decode(
        plaintext,
        conversationId,
      );

      if (!record) continue;

      const own = DirectMailboxOwnership.isAuthoredBy(
        IdentityId.fromString(record.authorId),
        owner,
      );
      const entries = byConversation.get(conversationId) ?? [];

      entries.push({
        plaintext: own
          ? DirectMessageMailboxRecord.encode(
              record,
              DirectMessageAuthorship.tag(rootKey, record),
            )
          : plaintext,
        recordId: record.id,
      });
      byConversation.set(conversationId, entries);
    }

    for (const [conversationId, entries] of byConversation) {
      await this.history.append(session, conversationId, entries);
    }
  }
}
