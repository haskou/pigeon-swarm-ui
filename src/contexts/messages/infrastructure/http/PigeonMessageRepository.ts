import type { DomainEvent } from '../../../../shared/domain/DomainEvent';
import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { IdentityAccessContexts } from '../../../identities/infrastructure/http/IdentityAccessContexts';
import type { Message } from '../../domain/Message';
import type { MessagePage } from '../../domain/MessagePage';
import type { MessageRepository } from '../../domain/repositories/MessageRepository';
import type { MessageConversationId } from '../../domain/value-objects/MessageConversationId';
import type { MessagePageLimit } from '../../domain/value-objects/MessagePageLimit';
import type { PigeonMessageCommandsApi } from './PigeonMessageCommandsApi';
import type { PigeonMessagesApi } from './PigeonMessagesApi';

import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { PinnedMessage } from '../../domain/entities/PinnedMessage';
import { MessageNotFoundError } from '../../domain/errors/MessageNotFoundError';
import { MessageDeleted } from '../../domain/events/MessageDeleted';
import { MessageEdited } from '../../domain/events/MessageEdited';
import { MessagePinned } from '../../domain/events/MessagePinned';
import { MessageReactionAdded } from '../../domain/events/MessageReactionAdded';
import { MessageReactionRemoved } from '../../domain/events/MessageReactionRemoved';
import { MessageUnpinned } from '../../domain/events/MessageUnpinned';
import { MessagePage as DomainMessagePage } from '../../domain/MessagePage';
import { MessageAuthorId } from '../../domain/value-objects/MessageAuthorId';
import { MessageId } from '../../domain/value-objects/MessageId';
import { MessageMapper } from './MessageMapper';
import { MessageOperationContexts } from './MessageOperationContexts';

export class PigeonMessageRepository implements MessageRepository {
  public constructor(
    private readonly messages: PigeonMessagesApi,
    private readonly commands: PigeonMessageCommandsApi,
    private readonly identities: IdentityAccessContexts,
    private readonly mapper: MessageMapper,
    private readonly operations: MessageOperationContexts,
  ) {}

  private session(authorId: MessageAuthorId): Session {
    return this.identities.find(IdentityId.fromString(authorId.toString()))
      .session;
  }

  private async persistEvent(
    message: Message,
    actorIdentityId: MessageAuthorId,
    event: DomainEvent,
  ): Promise<Message | undefined> {
    const primitives = message.toPrimitives();
    const session = this.session(actorIdentityId);

    if (event instanceof MessageEdited) {
      const edited = await this.commands.edit(
        session,
        primitives.conversationId,
        primitives.id,
        primitives.content,
        this.operations.consumeEdit(primitives.id),
        { createdAt: event.occurredAt },
      );

      return this.mapper.fromChatMessage(primitives.conversationId, edited);
    }

    if (event instanceof MessageDeleted) {
      await this.commands.delete(
        session,
        primitives.conversationId,
        primitives.id,
        { createdAt: event.occurredAt },
      );
    } else if (event instanceof MessagePinned) {
      await this.messages.pinMessage(
        session,
        primitives.conversationId,
        primitives.id,
      );
    } else if (event instanceof MessageUnpinned) {
      await this.messages.unpinMessage(
        session,
        primitives.conversationId,
        primitives.id,
      );
    } else if (event instanceof MessageReactionAdded) {
      await this.messages.addMessageReaction(
        session,
        primitives.conversationId,
        primitives.id,
        event.emojiUsed().toString(),
      );
    } else if (event instanceof MessageReactionRemoved) {
      await this.messages.removeMessageReaction(
        session,
        primitives.conversationId,
        primitives.id,
        event.emojiUsed().toString(),
      );
    }

    return undefined;
  }

  public async create(message: Message): Promise<Message> {
    const primitives = message.toPrimitives();
    const created = await this.commands.send(
      this.session(MessageAuthorId.fromString(primitives.authorId)),
      primitives.conversationId,
      primitives.content,
      this.operations.consumeSend(primitives.id),
      { createdAt: primitives.createdAt, id: primitives.id },
    );

    message.pullDomainEvents();

    return this.mapper.fromChatMessage(primitives.conversationId, created);
  }

  public async find(
    conversationId: MessageConversationId,
    messageId: MessageId,
    actorIdentityId: MessageAuthorId,
  ): Promise<Message> {
    const found = await this.messages.loadMessage(
      this.session(actorIdentityId),
      conversationId.toString(),
      messageId.toString(),
    );

    if (!found) throw new MessageNotFoundError();

    return this.mapper.fromChatMessage(conversationId.toString(), found);
  }

  public async save(
    message: Message,
    actorIdentityId: MessageAuthorId,
  ): Promise<Message> {
    for (const event of message.pullDomainEvents()) {
      const persisted = await this.persistEvent(
        message,
        actorIdentityId,
        event,
      );

      if (persisted) return persisted;
    }

    return message;
  }

  public async search(
    conversationId: MessageConversationId,
    actorIdentityId: MessageAuthorId,
    before: MessageId | undefined,
    limit: MessagePageLimit,
  ): Promise<MessagePage> {
    const result = await this.messages.loadMessages(
      this.session(actorIdentityId),
      conversationId.toString(),
      before?.toString(),
      {
        limit: limit.valueOf(),
        signal: this.operations.findLoadSignal(
          actorIdentityId.toString(),
          conversationId.toString(),
        ),
      },
    );

    return DomainMessagePage.create(
      result.messages.map((message) =>
        this.mapper.fromChatMessage(conversationId.toString(), message),
      ),
      result.nextCursor ? MessageId.fromString(result.nextCursor) : undefined,
    );
  }

  public async searchAround(
    conversationId: MessageConversationId,
    messageId: MessageId,
    actorIdentityId: MessageAuthorId,
  ): Promise<MessagePage> {
    const result = await this.messages.loadMessagesAround(
      this.session(actorIdentityId),
      conversationId.toString(),
      messageId.toString(),
    );

    return DomainMessagePage.create(
      result.messages.map((message) =>
        this.mapper.fromChatMessage(conversationId.toString(), message),
      ),
      result.nextCursor ? MessageId.fromString(result.nextCursor) : undefined,
      result.previousCursor
        ? MessageId.fromString(result.previousCursor)
        : undefined,
    );
  }

  public async searchPinned(
    conversationId: MessageConversationId,
    actorIdentityId: MessageAuthorId,
  ): Promise<PinnedMessage[]> {
    const pins = await this.messages.listMessagePins(
      this.session(actorIdentityId),
      conversationId.toString(),
    );

    return pins.map((pin) =>
      PinnedMessage.fromPrimitives({
        createdAt: pin.createdAt,
        message: this.mapper
          .fromChatMessage(conversationId.toString(), pin.message, true)
          .toPrimitives(),
        messageId: pin.messageId,
        pinnedByIdentityId: pin.pinnedByIdentityId,
      }),
    );
  }

  public async searchThread(
    conversationId: MessageConversationId,
    rootMessageId: MessageId,
    actorIdentityId: MessageAuthorId,
    limit: MessagePageLimit,
  ): Promise<MessagePage> {
    const result = await this.messages.loadMessageThread(
      this.session(actorIdentityId),
      conversationId.toString(),
      rootMessageId.toString(),
      { limit: limit.valueOf() },
    );

    return DomainMessagePage.create(
      result.messages.map((message) =>
        this.mapper.fromChatMessage(conversationId.toString(), message),
      ),
      result.nextBeforeMessageId
        ? MessageId.fromString(result.nextBeforeMessageId)
        : undefined,
    );
  }
}
