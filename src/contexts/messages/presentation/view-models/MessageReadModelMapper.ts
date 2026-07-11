import { Timestamp } from '@haskou/value-objects';

import type {
  ChatMessage,
  MessageReaction,
} from '../../../../shared/domain/pigeonResources.types';

import { Message } from '../../domain/aggregates/Message';
import { MessageReactionEntry } from '../../domain/entities/MessageReactionEntry';
import { MessageAuthorId } from '../../domain/value-objects/MessageAuthorId';
import { MessageContent } from '../../domain/value-objects/MessageContent';
import { MessageDeliveryState } from '../../domain/value-objects/MessageDeliveryState';
import { MessageId } from '../../domain/value-objects/MessageId';
import { MessageKind } from '../../domain/value-objects/MessageKind';
import { MessageReactionEmoji } from '../../domain/value-objects/MessageReactionEmoji';
import { MessageVisibility } from '../../domain/value-objects/MessageVisibility';

export class MessageReadModelMapper {
  public static toAggregate(readModel: ChatMessage): Message {
    return Message.reconstitute(
      MessageId.fromString(readModel.id),
      MessageAuthorId.fromString(readModel.authorIdentityId),
      MessageContent.fromString(readModel.content),
      MessageDeliveryState.fromPrimitive(readModel.deliveryStatus),
      MessageReadModelMapper.kindOf(readModel),
      readModel.encrypted
        ? MessageVisibility.encrypted()
        : MessageVisibility.readable(),
      readModel.reactions.map((reaction) =>
        new MessageReactionEntry(
          MessageAuthorId.fromString(reaction.authorIdentityId),
          MessageReactionEmoji.fromString(reaction.emoji),
          new Timestamp(reaction.createdAt),
        ),
      ),
    );
  }

  public static withAggregate(
    readModel: ChatMessage,
    message: Message,
  ): ChatMessage {
    const reactions: MessageReaction[] = message
      .getReactions()
      .map((reaction) => ({
        authorIdentityId: reaction.getAuthorId().toString(),
        createdAt: reaction.getCreatedAt().valueOf(),
        emoji: reaction.getEmoji().toString(),
      }));

    return {
      ...readModel,
      content: message.getContent().toString(),
      raw: { ...readModel.raw, reactions },
      reactions,
    };
  }

  private static kindOf(readModel: ChatMessage): MessageKind {
    if (readModel.kind === 'call-event') return MessageKind.callEvent();
    if (readModel.kind === 'poll' || readModel.poll) return MessageKind.poll();
    if (readModel.sticker) return MessageKind.sticker();

    return MessageKind.message();
  }
}
