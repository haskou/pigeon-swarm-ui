import { Timestamp } from '@haskou/value-objects';

import { MessageNotEditableError } from '../../../../contexts/messages/domain/errors/MessageNotEditableError';
import { MessageCreated } from '../../../../contexts/messages/domain/events/MessageCreated';
import { MessageEdited } from '../../../../contexts/messages/domain/events/MessageEdited';
import { Message } from '../../../../contexts/messages/domain/Message';
import { MessageAuthorId } from '../../../../contexts/messages/domain/value-objects/MessageAuthorId';
import { MessageContent } from '../../../../contexts/messages/domain/value-objects/MessageContent';
import { MessageConversationId } from '../../../../contexts/messages/domain/value-objects/MessageConversationId';
import { MessageId } from '../../../../contexts/messages/domain/value-objects/MessageId';
import { MessageKind } from '../../../../contexts/messages/domain/value-objects/MessageKind';
import { MessageReactionEmoji } from '../../../../contexts/messages/domain/value-objects/MessageReactionEmoji';
import { MessageVisibility } from '../../../../contexts/messages/domain/value-objects/MessageVisibility';

const authorId = MessageAuthorId.fromString('author-a');
const conversationId = MessageConversationId.fromString('conversation-a');
const messageId = MessageId.fromString('message-a');

function message(): Message {
  return Message.fromPrimitives({
    authorId: 'author-a',
    content: 'Hello',
    conversationId: 'conversation-a',
    createdAt: 100,
    deleted: false,
    deliveryState: 'delivered',
    encrypted: false,
    id: 'message-a',
    kind: 'message',
    pinned: false,
    reactions: [],
  });
}

describe(Message.name, () => {
  it('creates a pending aggregate and records its creation', () => {
    const aggregate = Message.create(
      messageId,
      conversationId,
      authorId,
      MessageContent.fromString('Hello'),
      MessageKind.message(),
      MessageVisibility.encrypted(),
      new Timestamp(100),
    );

    expect(aggregate.toPrimitives()).toMatchObject({
      deliveryState: 'pending',
      encrypted: true,
      id: 'message-a',
    });
    const [event] = aggregate.pullDomainEvents();

    expect(event).toBeInstanceOf(MessageCreated);
    expect(event.aggregateId).toBe('message-a');
    expect(event.occurredAt).toBe(100);
  });

  it('edits only delivered readable text owned by the author', () => {
    const aggregate = message();

    aggregate.edit(
      authorId,
      MessageContent.fromString('Updated'),
      new Timestamp(200),
    );

    expect(aggregate.toPrimitives().content).toBe('Updated');
    const [event] = aggregate.pullDomainEvents();

    expect(event).toBeInstanceOf(MessageEdited);
    expect(event.aggregateId).toBe('message-a');
    expect(event.occurredAt).toBe(200);
    expect(() =>
      aggregate.edit(
        MessageAuthorId.fromString('author-b'),
        MessageContent.fromString('Nope'),
        new Timestamp(300),
      ),
    ).toThrow(MessageNotEditableError);
  });

  it('owns reaction, pin and deletion state transitions', () => {
    const aggregate = message();
    const emoji = MessageReactionEmoji.fromString('👍');

    aggregate.addReaction(authorId, emoji, new Timestamp(200));
    aggregate.addReaction(authorId, emoji, new Timestamp(201));
    aggregate.pin(new Timestamp(202));
    aggregate.removeReaction(authorId, emoji, new Timestamp(203));
    aggregate.unpin(new Timestamp(204));
    aggregate.delete(authorId, new Timestamp(205));

    expect(aggregate.reactionCount()).toBe(0);
    expect(aggregate.toPrimitives()).toMatchObject({
      deleted: true,
      pinned: false,
    });
    expect(aggregate.pullDomainEvents().map((event) => event.type)).toEqual([
      'MessageReactionAdded',
      'MessagePinned',
      'MessageReactionRemoved',
      'MessageUnpinned',
      'MessageDeleted',
    ]);
  });

  it('hydrates and serializes without changing its state', () => {
    const primitives = message().toPrimitives();

    expect(Message.fromPrimitives(primitives).toPrimitives()).toEqual(
      primitives,
    );
  });
});
