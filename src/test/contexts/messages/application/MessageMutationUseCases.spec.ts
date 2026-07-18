import { mock } from 'jest-mock-extended';

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
    await new MessageDeleter(repository).delete(
      new DeleteMessageMessage(mutation),
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

    await new MessageReactionAdder(repository).add(
      new AddMessageReactionMessage({ ...mutation, emoji: '👍' }),
    );
    expect(aggregate.reactionCount()).toBe(1);

    await new MessageReactionRemover(repository).remove(
      new RemoveMessageReactionMessage({ ...mutation, emoji: '👍' }),
    );
    expect(aggregate.reactionCount()).toBe(0);
  });

  it('pins and unpins through the aggregate', async () => {
    const repository = mock<MessageRepository>();
    const aggregate = message();

    repository.find.mockResolvedValue(aggregate);
    repository.save.mockResolvedValue(aggregate);

    await new MessagePinner(repository).pin(new PinMessageMessage(mutation));
    expect(aggregate.toPrimitives().pinned).toBe(true);

    await new MessageUnpinner(repository).unpin(
      new UnpinMessageMessage(mutation),
    );
    expect(aggregate.toPrimitives().pinned).toBe(false);
  });
});
