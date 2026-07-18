import { Timestamp, ValueNotInEnumError } from '@haskou/value-objects';

import { MessageReactionEntry } from '../../../../contexts/messages/domain/entities/MessageReactionEntry';
import { ConversationDraftSaved } from '../../../../contexts/messages/domain/events/ConversationDraftSaved';
import { ConversationDraftEventType } from '../../../../contexts/messages/domain/value-objects/ConversationDraftEventType';
import { MessageAuthorId } from '../../../../contexts/messages/domain/value-objects/MessageAuthorId';
import { MessageConversationId } from '../../../../contexts/messages/domain/value-objects/MessageConversationId';
import { MessageDeliveryState } from '../../../../contexts/messages/domain/value-objects/MessageDeliveryState';
import { MessageEventType } from '../../../../contexts/messages/domain/value-objects/MessageEventType';
import { MessageReactionAction } from '../../../../contexts/messages/domain/value-objects/MessageReactionAction';
import { MessageReactionEmoji } from '../../../../contexts/messages/domain/value-objects/MessageReactionEmoji';

describe('message supporting domain concepts', () => {
  it('hydrates reaction entries and compares their identity', () => {
    const entry = MessageReactionEntry.fromPrimitives({
      authorId: 'author-a',
      createdAt: 100,
      emoji: '👍',
    });

    expect(
      entry.belongsTo(
        MessageAuthorId.fromString('author-a'),
        MessageReactionEmoji.fromString('👍'),
      ),
    ).toBe(true);
    expect(entry.toPrimitives()).toEqual({
      authorId: 'author-a',
      createdAt: 100,
      emoji: '👍',
    });
  });

  it('models reaction actions and delivery states without primitive branching', () => {
    expect(MessageReactionAction.fromPrimitives('add').isAdd()).toBe(true);
    expect(MessageReactionAction.remove().isRemove()).toBe(true);
    expect(MessageDeliveryState.fromPrimitives().isDelivered()).toBe(true);
    expect(MessageDeliveryState.pending().isDelivered()).toBe(false);
    expect(() => MessageReactionAction.fromPrimitives('replace')).toThrow(
      ValueNotInEnumError,
    );
    expect(() => MessageDeliveryState.fromPrimitives('lost')).toThrow(
      ValueNotInEnumError,
    );
  });

  it('serializes message and draft event types at their event boundary', () => {
    expect(
      MessageEventType.fromPrimitives('MessageEdited').isEqual(
        MessageEventType.EDITED,
      ),
    ).toBe(true);
    expect(ConversationDraftEventType.SAVED.valueOf()).toBe(
      'ConversationDraftSaved',
    );

    const event = new ConversationDraftSaved(
      MessageConversationId.fromString('conversation-a'),
      new Timestamp(100),
    );

    expect(event).toMatchObject({
      aggregateId: 'conversation-a',
      occurredAt: 100,
      type: 'ConversationDraftSaved',
    });
  });
});
