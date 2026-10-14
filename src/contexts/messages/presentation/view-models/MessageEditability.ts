import type { ChatMessage } from '../../domain/ChatMessage';

import { IdentityMatch } from '../../../identities/domain/IdentityMatch';
import { MessageAuthorId } from '../../domain/value-objects/MessageAuthorId';
import { MessageReadModelMapper } from './MessageReadModelMapper';

export class MessageEditability {
  /** Only the author deletes, and polls are never deleted. */
  public static canDelete(message: ChatMessage, identityId: string): boolean {
    return (
      message.kind !== 'poll' &&
      IdentityMatch.isSame(message.authorIdentityId, identityId)
    );
  }

  public static canEdit(message: ChatMessage, identityId: string): boolean {
    return MessageReadModelMapper.toAggregate(message).canBeEditedBy(
      MessageAuthorId.fromString(identityId),
    );
  }
}
