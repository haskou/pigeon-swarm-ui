import { Timestamp } from '@haskou/value-objects';

import type { ChatMessage } from '../../../shared/domain/pigeonResources.types';

import { Message } from './aggregates/message';
import { MessageAuthorId } from './value-objects/messageAuthorId';
import { MessageReactionAction } from './value-objects/messageReactionAction';
import { MessageReactionEmoji } from './value-objects/messageReactionEmoji';

export class MessageReactions {
  public static update(
    message: ChatMessage,
    authorIdentityId: string,
    emoji: string,
    action: 'add' | 'remove',
    createdAt = Date.now(),
  ): ChatMessage {
    const messageAggregate = Message.fromChatMessage(message);
    const reactionAuthorId = MessageAuthorId.fromString(authorIdentityId);
    const reactionEmoji = MessageReactionEmoji.fromString(emoji);
    const reactionAction = MessageReactionAction.fromPrimitive(action);

    if (reactionAction.isAdd()) {
      messageAggregate.addReaction(
        reactionAuthorId,
        reactionEmoji,
        new Timestamp(createdAt),
      );
    }

    if (reactionAction.isRemove()) {
      messageAggregate.removeReaction(reactionAuthorId, reactionEmoji);
    }

    return messageAggregate.toChatMessage();
  }
}
