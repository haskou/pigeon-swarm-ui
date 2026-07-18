import type { PrimitiveOf } from '@haskou/value-objects';

import type { Message } from '../../domain/Message';
import type { ChatMessage } from '../../presentation/view-models/ChatMessage';

import { Message as MessageAggregate } from '../../domain/Message';

export class MessageMapper {
  private readonly projections = new WeakMap<Message, ChatMessage>();

  private deliveryStatus(
    deliveryState: PrimitiveOf<Message>['deliveryState'],
  ): ChatMessage['deliveryStatus'] {
    if (deliveryState === 'failed') return 'failed';

    if (deliveryState === 'pending') return 'pending';

    return undefined;
  }

  private kind(kind: PrimitiveOf<Message>['kind']): ChatMessage['kind'] {
    if (kind === 'call-event') return 'call-event';

    if (kind === 'poll') return 'poll';

    return 'message';
  }

  public fromChatMessage(
    conversationId: string,
    projection: ChatMessage,
    pinned?: boolean,
  ): Message {
    const message = MessageAggregate.fromPrimitives({
      authorId: projection.authorIdentityId,
      content: projection.content,
      conversationId,
      createdAt: projection.timestamp,
      deleted: projection.raw.type === 'deleted',
      deliveryState: projection.deliveryStatus ?? 'delivered',
      encrypted: projection.encrypted,
      id: projection.id,
      kind: projection.kind ?? (projection.sticker ? 'sticker' : 'message'),
      pinned: pinned ?? Boolean(projection.raw.pinnedByIdentityId),
      reactions: projection.reactions.map((reaction) => ({
        authorId: reaction.authorIdentityId,
        createdAt: reaction.createdAt,
        emoji: reaction.emoji,
      })),
    });

    this.projections.set(message, projection);

    return message;
  }

  public toChatMessage(message: Message): ChatMessage {
    const primitives = message.toPrimitives();
    const projection = this.projections.get(message);
    const reactions = primitives.reactions.map((reaction) => ({
      authorIdentityId: reaction.authorId,
      createdAt: reaction.createdAt,
      emoji: reaction.emoji,
    }));

    if (projection) {
      return {
        ...projection,
        content: primitives.content,
        deliveryStatus: this.deliveryStatus(primitives.deliveryState),
        encrypted: primitives.encrypted,
        reactions,
      };
    }

    return {
      attachments: [],
      authorIdentityId: primitives.authorId,
      content: primitives.content,
      deliveryStatus: this.deliveryStatus(primitives.deliveryState),
      encrypted: primitives.encrypted,
      id: primitives.id,
      kind: this.kind(primitives.kind),
      mine: false,
      raw: {
        authorIdentityId: primitives.authorId,
        conversationId: primitives.conversationId,
        createdAt: primitives.createdAt,
        id: primitives.id,
        type: primitives.deleted ? 'deleted' : 'sent',
      },
      reactions,
      timestamp: primitives.createdAt,
    };
  }
}
