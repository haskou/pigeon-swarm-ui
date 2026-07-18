import { Timestamp } from '@haskou/value-objects';

import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

import { MessageAuthorId } from '../../domain/value-objects/MessageAuthorId';
import { MessageReactionAction } from '../../domain/value-objects/MessageReactionAction';
import { MessageReactionEmoji } from '../../domain/value-objects/MessageReactionEmoji';
import { MessageReadModelMapper } from './MessageReadModelMapper';

export class MessageReactionUpdater {
  public static update(
    message: ChatMessage,
    authorIdentityId: string,
    emoji: string,
    action: 'add' | 'remove',
    createdAt = Date.now(),
  ): ChatMessage {
    const aggregate = MessageReadModelMapper.toAggregate(message);
    const authorId = MessageAuthorId.fromString(authorIdentityId);
    const reactionEmoji = MessageReactionEmoji.fromString(emoji);
    const reactionAction = MessageReactionAction.fromPrimitives(action);

    if (reactionAction.isAdd()) {
      aggregate.addReaction(authorId, reactionEmoji, new Timestamp(createdAt));
    }

    if (reactionAction.isRemove()) {
      aggregate.removeReaction(
        authorId,
        reactionEmoji,
        new Timestamp(createdAt),
      );
    }

    return MessageReadModelMapper.withAggregate(message, aggregate);
  }
}
