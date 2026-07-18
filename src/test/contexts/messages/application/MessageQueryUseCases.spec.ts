import { mock } from 'jest-mock-extended';

import type { MessageRepository } from '../../../../contexts/messages/domain/repositories/MessageRepository';

import { ListMessagePinsMessage } from '../../../../contexts/messages/application/list-message-pins/messages/ListMessagePinsMessage';
import { PinnedMessagesSearcher } from '../../../../contexts/messages/application/list-message-pins/PinnedMessagesSearcher';
import { LoadMessageThreadMessage } from '../../../../contexts/messages/application/load-message-thread/messages/LoadMessageThreadMessage';
import { MessageThreadSearcher } from '../../../../contexts/messages/application/load-message-thread/MessageThreadSearcher';
import { MessageFinder } from '../../../../contexts/messages/application/load-message/MessageFinder';
import { LoadMessageMessage } from '../../../../contexts/messages/application/load-message/messages/LoadMessageMessage';
import { LoadMessagesAroundMessage } from '../../../../contexts/messages/application/load-messages-around/messages/LoadMessagesAroundMessage';
import { MessagesAroundSearcher } from '../../../../contexts/messages/application/load-messages-around/MessagesAroundSearcher';
import { LoadMessagesMessage } from '../../../../contexts/messages/application/load-messages/messages/LoadMessagesMessage';
import { MessagesSearcher } from '../../../../contexts/messages/application/load-messages/MessagesSearcher';
import { PinnedMessage } from '../../../../contexts/messages/domain/entities/PinnedMessage';
import { Message } from '../../../../contexts/messages/domain/Message';
import { MessagePage } from '../../../../contexts/messages/domain/MessagePage';

const input = {
  actorIdentityId: 'author-a',
  conversationId: 'conversation-a',
  messageId: 'message-a',
};

const aggregate = Message.fromPrimitives({
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

describe('message query use cases', () => {
  it('finds one message', async () => {
    const repository = mock<MessageRepository>();

    repository.find.mockResolvedValue(aggregate);

    await expect(
      new MessageFinder(repository).find(new LoadMessageMessage(input)),
    ).resolves.toBe(aggregate);
  });

  it('searches timeline, surrounding, thread and pinned pages', async () => {
    const repository = mock<MessageRepository>();
    const page = MessagePage.create([aggregate]);
    const pins = [
      PinnedMessage.fromPrimitives({
        createdAt: 100,
        message: aggregate.toPrimitives(),
        messageId: 'message-a',
        pinnedByIdentityId: 'moderator-a',
      }),
    ];

    repository.search.mockResolvedValue(page);
    repository.searchAround.mockResolvedValue(page);
    repository.searchThread.mockResolvedValue(page);
    repository.searchPinned.mockResolvedValue(pins);

    await expect(
      new MessagesSearcher(repository).search(
        new LoadMessagesMessage({ ...input, before: 'older', limit: 20 }),
      ),
    ).resolves.toBe(page);
    await expect(
      new MessagesAroundSearcher(repository).search(
        new LoadMessagesAroundMessage(input),
      ),
    ).resolves.toBe(page);
    await expect(
      new MessageThreadSearcher(repository).search(
        new LoadMessageThreadMessage({ ...input, limit: 50 }),
      ),
    ).resolves.toBe(page);
    await expect(
      new PinnedMessagesSearcher(repository).search(
        new ListMessagePinsMessage(input),
      ),
    ).resolves.toBe(pins);
  });
});
