import { mock, type MockProxy } from 'jest-mock-extended';

import type { DirectMessageRepository } from '../../../../contexts/messages/domain/repositories/DirectMessageRepository';
import type { MessageRepository } from '../../../../contexts/messages/domain/repositories/MessageRepository';

import { MessageReactionAdder } from '../../../../contexts/messages/application/add-message-reaction/MessageReactionAdder';
import { AddMessageReactionMessage } from '../../../../contexts/messages/application/add-message-reaction/messages/AddMessageReactionMessage';
import { MessageDeleter } from '../../../../contexts/messages/application/delete-message/MessageDeleter';
import { DeleteMessageMessage } from '../../../../contexts/messages/application/delete-message/messages/DeleteMessageMessage';
import { MessageEditor } from '../../../../contexts/messages/application/edit-message/MessageEditor';
import { EditMessageMessage } from '../../../../contexts/messages/application/edit-message/messages/EditMessageMessage';
import { MessagePinner } from '../../../../contexts/messages/application/pin-message/MessagePinner';
import { PinMessageMessage } from '../../../../contexts/messages/application/pin-message/messages/PinMessageMessage';
import { MessageReactionRemover } from '../../../../contexts/messages/application/remove-message-reaction/MessageReactionRemover';
import { RemoveMessageReactionMessage } from '../../../../contexts/messages/application/remove-message-reaction/messages/RemoveMessageReactionMessage';
import { SendMessageMessage } from '../../../../contexts/messages/application/send-message/messages/SendMessageMessage';
import { MessageSender } from '../../../../contexts/messages/application/send-message/MessageSender';
import { UnpinMessageMessage } from '../../../../contexts/messages/application/unpin-message/messages/UnpinMessageMessage';
import { MessageUnpinner } from '../../../../contexts/messages/application/unpin-message/MessageUnpinner';
import { Message } from '../../../../contexts/messages/domain/Message';

function message() {
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

const mutation = {
  authorIdentityId: 'author-a',
  conversationId: 'conversation-a',
  messageId: 'message-a',
  occurredAt: 200,
};

const groupMutation = {
  authorIdentityId: 'author-a',
  conversationId: 'conversation-a',
  conversationType: 'group',
  messageId: 'message-a',
};

const directMutation = {
  ...groupMutation,
  conversationType: 'one-to-one',
};

describe('message mutation use cases', () => {
  it('creates a message through the aggregate and repository', async () => {
    const repository = mock<MessageRepository>();

    repository.create.mockImplementation((aggregate) =>
      Promise.resolve(aggregate),
    );
    const result = await new MessageSender(repository).send(
      new SendMessageMessage({
        ...mutation,
        content: 'Hello',
        encrypted: true,
      }),
    );

    expect(result.toPrimitives()).toMatchObject({
      content: 'Hello',
      encrypted: true,
      id: 'message-a',
    });
    expect(repository.create).toHaveBeenCalledWith(result);
  });

  it('edits and deletes a found aggregate before saving it', async () => {
    const repository = mock<MessageRepository>();
    const aggregate = message();

    repository.find.mockResolvedValue(aggregate);
    repository.save.mockImplementation((saved) => Promise.resolve(saved));

    await new MessageEditor(repository).edit(
      new EditMessageMessage({ ...mutation, content: 'Updated' }),
    );
    await new MessageDeleter(repository, mock<DirectMessageRepository>()).delete(
      new DeleteMessageMessage(groupMutation),
    );

    expect(aggregate.toPrimitives()).toMatchObject({
      content: 'Updated',
      deleted: true,
    });
    expect(repository.save).toHaveBeenCalledTimes(2);
  });

  it('adds and removes reactions through the aggregate', async () => {
    const repository = mock<MessageRepository>();
    const aggregate = message();

    repository.find.mockResolvedValue(aggregate);
    repository.save.mockResolvedValue(aggregate);

    await new MessageReactionAdder(
      repository,
      mock<DirectMessageRepository>(),
    ).add(new AddMessageReactionMessage({ ...groupMutation, emoji: '👍' }));
    expect(aggregate.reactionCount()).toBe(1);

    await new MessageReactionRemover(
      repository,
      mock<DirectMessageRepository>(),
    ).remove(new RemoveMessageReactionMessage({ ...groupMutation, emoji: '👍' }));
    expect(aggregate.reactionCount()).toBe(0);
  });

  it('pins and unpins through the aggregate', async () => {
    const repository = mock<MessageRepository>();
    const aggregate = message();

    repository.find.mockResolvedValue(aggregate);
    repository.save.mockResolvedValue(aggregate);

    await new MessagePinner(repository, mock<DirectMessageRepository>()).pin(
      new PinMessageMessage(groupMutation),
    );
    expect(aggregate.toPrimitives().pinned).toBe(true);

    await new MessageUnpinner(
      repository,
      mock<DirectMessageRepository>(),
    ).unpin(new UnpinMessageMessage(groupMutation));
    expect(aggregate.toPrimitives().pinned).toBe(false);
  });

  describe('one-to-one conversation', () => {
    let before: number;
    let directRepository: MockProxy<DirectMessageRepository>;
    let repository: MockProxy<MessageRepository>;

    beforeEach(() => {
      before = Date.now();
      directRepository = mock<DirectMessageRepository>();
      repository = mock<MessageRepository>();
    });

    afterEach(() => {
      expect(repository.find).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('pins through the direct mailbox at the current time', async () => {
      await new MessagePinner(repository, directRepository).pin(
        new PinMessageMessage(directMutation),
      );

      const [conversationId, change, actorId] =
        directRepository.pin.mock.calls[0] ?? [];

      expect(conversationId?.toString()).toBe('conversation-a');
      expect(actorId?.toString()).toBe('author-a');
      expect(change?.getAction().isPin()).toBe(true);
      expect(change?.getMessageId().toString()).toBe('message-a');
      expect(change?.getCreatedAt().valueOf()).toBeGreaterThanOrEqual(before);
    });

    it('unpins through the direct mailbox at the current time', async () => {
      await new MessageUnpinner(repository, directRepository).unpin(
        new UnpinMessageMessage(directMutation),
      );

      const [, change] = directRepository.pin.mock.calls[0] ?? [];

      expect(change?.getAction().isPin()).toBe(false);
      expect(change?.getMessageId().toString()).toBe('message-a');
      expect(change?.getCreatedAt().valueOf()).toBeGreaterThanOrEqual(before);
    });

    it('deletes through the direct mailbox', async () => {
      await new MessageDeleter(repository, directRepository).delete(
        new DeleteMessageMessage(directMutation),
      );

      const [conversationId, messageId, actorId] =
        directRepository.delete.mock.calls[0] ?? [];

      expect(conversationId?.toString()).toBe('conversation-a');
      expect(messageId?.toString()).toBe('message-a');
      expect(actorId?.toString()).toBe('author-a');
    });

    it('adds a reaction through the direct mailbox at the current time', async () => {
      await new MessageReactionAdder(repository, directRepository).add(
        new AddMessageReactionMessage({ ...directMutation, emoji: '👍' }),
      );

      const [conversationId, change, actorId] =
        directRepository.react.mock.calls[0] ?? [];

      expect(conversationId?.toString()).toBe('conversation-a');
      expect(actorId?.toString()).toBe('author-a');
      expect(change?.getAction().isAdd()).toBe(true);
      expect(change?.getEmoji().toString()).toBe('👍');
      expect(change?.getMessageId().toString()).toBe('message-a');
      expect(change?.getCreatedAt().valueOf()).toBeGreaterThanOrEqual(before);
    });

    it('removes a reaction through the direct mailbox at the current time', async () => {
      await new MessageReactionRemover(repository, directRepository).remove(
        new RemoveMessageReactionMessage({ ...directMutation, emoji: '👍' }),
      );

      const [, change] = directRepository.react.mock.calls[0] ?? [];

      expect(change?.getAction().isRemove()).toBe(true);
      expect(change?.getEmoji().toString()).toBe('👍');
      expect(change?.getCreatedAt().valueOf()).toBeGreaterThanOrEqual(before);
    });
  });
});
