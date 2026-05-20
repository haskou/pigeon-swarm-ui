import { Timestamp } from '@haskou/value-objects';

import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

import { MessageAuthorId } from '../value-objects/messageAuthorId';
import { MessageReactionEmoji } from '../value-objects/messageReactionEmoji';
import { Message } from './message';

const chatMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  attachments: [],
  authorIdentityId: 'author-a',
  content: 'Hello',
  encrypted: false,
  id: 'message-a',
  mine: false,
  raw: {},
  reactions: [],
  timestamp: 100,
  ...overrides,
});

describe('Message', () => {
  it('adds a reaction once per author and emoji', () => {
    const message = Message.fromChatMessage(chatMessage());
    const authorId = MessageAuthorId.fromString('author-b');
    const emoji = MessageReactionEmoji.fromString('👍');

    message.addReaction(authorId, emoji, new Timestamp(200));
    message.addReaction(authorId, emoji, new Timestamp(300));

    expect(message.hasReaction(authorId, emoji)).toBe(true);
    expect(message.reactionCount()).toBe(1);
    expect(message.pullDomainEvents()).toHaveLength(3);
  });

  it('removes a matching reaction without exposing reaction internals', () => {
    const message = Message.fromChatMessage(
      chatMessage({
        reactions: [
          { authorIdentityId: 'author-b', createdAt: 200, emoji: '👍' },
        ],
      }),
    );
    const authorId = MessageAuthorId.fromString('author-b');
    const emoji = MessageReactionEmoji.fromString('👍');

    message.removeReaction(authorId, emoji);

    expect(message.hasReaction(authorId, emoji)).toBe(false);
    expect(message.reactionCount()).toBe(0);
  });
});
