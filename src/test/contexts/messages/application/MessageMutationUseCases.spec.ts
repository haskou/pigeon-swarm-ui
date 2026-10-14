import { mock, type MockProxy } from 'jest-mock-extended';

import type { DirectMessageRepository } from '../../../../contexts/messages/domain/repositories/DirectMessageRepository';

import { MessageReactionAdder } from '../../../../contexts/messages/application/add-message-reaction/MessageReactionAdder';
import { AddMessageReactionMessage } from '../../../../contexts/messages/application/add-message-reaction/messages/AddMessageReactionMessage';
import { MessageDeleter } from '../../../../contexts/messages/application/delete-message/MessageDeleter';
import { DeleteMessageMessage } from '../../../../contexts/messages/application/delete-message/messages/DeleteMessageMessage';
import { MessagePinner } from '../../../../contexts/messages/application/pin-message/MessagePinner';
import { PinMessageMessage } from '../../../../contexts/messages/application/pin-message/messages/PinMessageMessage';
import { MessageReactionRemover } from '../../../../contexts/messages/application/remove-message-reaction/MessageReactionRemover';
import { RemoveMessageReactionMessage } from '../../../../contexts/messages/application/remove-message-reaction/messages/RemoveMessageReactionMessage';
import { UnpinMessageMessage } from '../../../../contexts/messages/application/unpin-message/messages/UnpinMessageMessage';
import { MessageUnpinner } from '../../../../contexts/messages/application/unpin-message/MessageUnpinner';

const directMutation = {
  authorIdentityId: 'author-a',
  conversationId: 'conversation-a',
  messageId: 'message-a',
};

describe('message mutation use cases', () => {
  describe('one-to-one conversation', () => {
    let before: number;
    let directRepository: MockProxy<DirectMessageRepository>;

    beforeEach(() => {
      before = Date.now();
      directRepository = mock<DirectMessageRepository>();
    });

    it('pins through the direct mailbox at the current time', async () => {
      await new MessagePinner(directRepository).pin(
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
      await new MessageUnpinner(directRepository).unpin(
        new UnpinMessageMessage(directMutation),
      );

      const [, change] = directRepository.pin.mock.calls[0] ?? [];

      expect(change?.getAction().isPin()).toBe(false);
      expect(change?.getMessageId().toString()).toBe('message-a');
      expect(change?.getCreatedAt().valueOf()).toBeGreaterThanOrEqual(before);
    });

    it('deletes through the direct mailbox', async () => {
      await new MessageDeleter(directRepository).delete(
        new DeleteMessageMessage(directMutation),
      );

      const [conversationId, messageId, actorId] =
        directRepository.delete.mock.calls[0] ?? [];

      expect(conversationId?.toString()).toBe('conversation-a');
      expect(messageId?.toString()).toBe('message-a');
      expect(actorId?.toString()).toBe('author-a');
    });

    it('adds a reaction through the direct mailbox at the current time', async () => {
      await new MessageReactionAdder(directRepository).add(
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
      await new MessageReactionRemover(directRepository).remove(
        new RemoveMessageReactionMessage({ ...directMutation, emoji: '👍' }),
      );

      const [, change] = directRepository.react.mock.calls[0] ?? [];

      expect(change?.getAction().isRemove()).toBe(true);
      expect(change?.getEmoji().toString()).toBe('👍');
      expect(change?.getCreatedAt().valueOf()).toBeGreaterThanOrEqual(before);
    });
  });
});
