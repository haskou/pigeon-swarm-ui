import {
  MailboxRecordAuthorship,
  type SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';

import type { DirectMessageRecord } from '../../../mailboxes/domain/DirectMessageRecord';

import { IdentityMatch } from '../../../identities/domain/IdentityMatch';
import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';

/**
 * Authorship policy for records in this identity's own inbox. The peer holds
 * the conversation secret, which keys the self-inbox, but never the root key,
 * so it cannot make a `MailboxRecordAuthorship` tag that verifies. A record
 * whose author is this identity is applied only with a valid tag.
 */
export class DirectMessageAuthorship {
  /**
   * A record whose author id is not a valid identity id is refused. A record
   * authored by another identity is not checked here. A record
   * authored by this identity must carry a tag made under its root key, so a
   * peer that writes into the self-inbox cannot forge or replay it.
   */
  public static isAuthentic(
    identityId: string,
    rootKey: SymmetricKey,
    record: DirectMessageRecord,
    authorTag: string | undefined,
  ): boolean {
    if (!IdentityId.isValid(record.authorId)) return false;

    if (!IdentityMatch.isSame(record.authorId, identityId)) {
      return true;
    }

    return (
      authorTag !== undefined &&
      MailboxRecordAuthorship.verify(rootKey, record, authorTag)
    );
  }
}
