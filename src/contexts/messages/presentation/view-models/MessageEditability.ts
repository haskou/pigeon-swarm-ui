import type { ChatMessage } from '../../domain/ChatMessage';

import { MessageAuthorId } from '../../domain/value-objects/MessageAuthorId';
import { MessageReadModelMapper } from './MessageReadModelMapper';

export class MessageEditability {
  public static canEdit(message: ChatMessage, identityId: string): boolean {
    return MessageReadModelMapper.toAggregate(message).canBeEditedBy(
      MessageAuthorId.fromString(identityId),
    );
  }
}
