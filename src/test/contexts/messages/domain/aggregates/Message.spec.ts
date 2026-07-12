import { Timestamp } from '@haskou/value-objects';

import { Message } from '../../../../../contexts/messages/domain/aggregates/Message';
import { MessageReactionEntry } from '../../../../../contexts/messages/domain/entities/MessageReactionEntry';
import { MessageAuthorId } from '../../../../../contexts/messages/domain/value-objects/MessageAuthorId';
import { MessageContent } from '../../../../../contexts/messages/domain/value-objects/MessageContent';
import { MessageDeliveryState } from '../../../../../contexts/messages/domain/value-objects/MessageDeliveryState';
import { MessageId } from '../../../../../contexts/messages/domain/value-objects/MessageId';
import { MessageKind } from '../../../../../contexts/messages/domain/value-objects/MessageKind';
import { MessageReactionEmoji } from '../../../../../contexts/messages/domain/value-objects/MessageReactionEmoji';
import { MessageVisibility } from '../../../../../contexts/messages/domain/value-objects/MessageVisibility';

const message = (reactions: readonly MessageReactionEntry[] = []): Message =>
  Message.reconstitute(
    MessageId.fromString('message-a'),
    MessageAuthorId.fromString('author-a'),
    MessageContent.fromString('Hello'),
    MessageDeliveryState.delivered(),
    MessageKind.message(),
    MessageVisibility.readable(),
    reactions,
  );

describe('Message', () => {
  it('adds a reaction once per author and emoji', () => {
    const aggregate = message();
    const authorId = MessageAuthorId.fromString('author-b');
    const emoji = MessageReactionEmoji.fromString('👍');

    aggregate.addReaction(authorId, emoji, new Timestamp(200));
    aggregate.addReaction(authorId, emoji, new Timestamp(300));

    expect(aggregate.hasReaction(authorId, emoji)).toBe(true);
    expect(aggregate.reactionCount()).toBe(1);
    expect(aggregate.pullDomainEvents()).toHaveLength(3);
  });

  it('removes a matching reaction without exposing reaction internals', () => {
    const aggregate = message([
      new MessageReactionEntry(
        MessageAuthorId.fromString('author-b'),
        MessageReactionEmoji.fromString('👍'),
        new Timestamp(200),
      ),
    ]);
    const authorId = MessageAuthorId.fromString('author-b');
    const emoji = MessageReactionEmoji.fromString('👍');

    aggregate.removeReaction(authorId, emoji);

    expect(aggregate.hasReaction(authorId, emoji)).toBe(false);
    expect(aggregate.reactionCount()).toBe(0);
  });

  it('allows its author to edit a delivered readable text message', () => {
    const aggregate = message();
    const author = MessageAuthorId.fromString('author-a');

    aggregate.edit(author, MessageContent.fromString('Updated'));

    expect(
      aggregate.getContent().isEqual(MessageContent.fromString('Updated')),
    ).toBe(true);
    expect(aggregate.pullDomainEvents()).toHaveLength(1);
  });

  it('does not allow a non-author to edit a message', () => {
    expect(
      message().canBeEditedBy(MessageAuthorId.fromString('author-b')),
    ).toBe(false);
  });
});
