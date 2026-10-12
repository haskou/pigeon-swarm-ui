import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { DirectMessageRecord } from '../../../mailboxes/domain/DirectMessageRecord';
import type { DirectReadRecord } from '../../../mailboxes/domain/DirectReadRecord';

import { sessionRootKey } from '../../../identities/infrastructure/session/sessionRootKey';
import { DirectMailboxOwnership } from '../../../mailboxes/domain/DirectMailboxOwnership';
import { DirectMailboxRecords } from '../../../mailboxes/domain/DirectMailboxRecords';
import { DirectMessageAuthorship } from './DirectMessageAuthorship';
import { DirectMessageMailboxRecord } from './DirectMessageMailboxRecord';

/** Decodes inbox envelopes for this identity's reads. */
export class DirectMessageRecordReader {
  /** Decodes one envelope; author tags are checked against this identity. */
  public static decode(
    session: Session,
    conversationId: string,
    plaintext: Uint8Array,
  ): DirectMessageRecord | null {
    return DirectMessageMailboxRecord.decode(
      plaintext,
      conversationId,
      (record, authorTag) =>
        DirectMessageAuthorship.isAuthentic(
          session.identity.id,
          sessionRootKey(session).getBuffer(),
          record,
          authorTag,
        ),
    );
  }

  /** Own read receipts only, and only while they are fresh. */
  public static isOwnFreshRead(
    session: Session,
    record: DirectReadRecord,
  ): boolean {
    return (
      DirectMailboxOwnership.isAuthoredBy(
        record.authorId,
        session.identity.id,
      ) && DirectMailboxRecords.isFreshReceipt(record, Date.now())
    );
  }
}
