import type {
  ChatMessage,
  MessageReaction,
} from '../../../../shared/domain/pigeonResources.types';

import { Message } from '../../domain/Message';
import { MessageAuthorId } from '../../domain/value-objects/MessageAuthorId';

export class MessageReadModelMapper {
  public static toAggregate(readModel: ChatMessage): Message {
    return Message.fromPrimitives({
      authorId: readModel.authorIdentityId,
      content: readModel.content,
      conversationId: readModel.raw.conversationId ?? readModel.id,
      createdAt: readModel.timestamp,
      deleted: readModel.raw.type === 'deleted',
      deliveryState: readModel.deliveryStatus ?? 'delivered',
      encrypted: readModel.encrypted,
      id: readModel.id,
      kind: MessageReadModelMapper.kindOf(readModel),
      pinned: Boolean(readModel.raw.pinnedByIdentityId),
      reactions: readModel.reactions.map((reaction) => ({
        authorId: reaction.authorIdentityId,
        createdAt: reaction.createdAt,
        emoji: reaction.emoji,
      })),
    });
  }

  public static withAggregate(
    readModel: ChatMessage,
    message: Message,
  ): ChatMessage {
    const primitives = message.toPrimitives();
    const reactions: MessageReaction[] = primitives.reactions.map(
      (reaction) => ({
        authorIdentityId: reaction.authorId,
        createdAt: reaction.createdAt,
        emoji: reaction.emoji,
      }),
    );

    return {
      ...readModel,
      content: primitives.content,
      raw: { ...readModel.raw, reactions },
      reactions,
    };
  }

  private static kindOf(readModel: ChatMessage) {
    if (readModel.kind === 'call-event') return 'call-event';
    if (readModel.kind === 'poll' || readModel.poll) return 'poll';
    if (readModel.sticker) return 'sticker';

    return 'message';
  }
}
