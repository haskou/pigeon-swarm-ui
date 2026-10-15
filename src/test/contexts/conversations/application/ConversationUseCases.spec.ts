import { mock, type MockProxy } from 'jest-mock-extended';

import type { ConversationReadReceiptRepository } from '../../../../contexts/conversations/domain/repositories/ConversationReadReceiptRepository';
import type { ConversationRepository } from '../../../../contexts/conversations/domain/repositories/ConversationRepository';

import { ConversationCreator } from '../../../../contexts/conversations/application/create-conversation/ConversationCreator';
import { CreateConversationMessage } from '../../../../contexts/conversations/application/create-conversation/messages/CreateConversationMessage';
import { ConversationReadMarker } from '../../../../contexts/conversations/application/mark-conversation-read-until/ConversationReadMarker';
import { MarkConversationReadUntilMessage } from '../../../../contexts/conversations/application/mark-conversation-read-until/messages/MarkConversationReadUntilMessage';
import { ConversationsSearcher } from '../../../../contexts/conversations/application/search-conversations/ConversationsSearcher';
import { SearchConversationsMessage } from '../../../../contexts/conversations/application/search-conversations/messages/SearchConversationsMessage';
import { Conversation } from '../../../../contexts/conversations/domain/Conversation';
import { ConversationIdFactory } from '../../../../contexts/conversations/domain/ConversationIdFactory';

function conversation(
  id: string,
  latestMessageAt: number,
  type: 'group' | 'one-to-one' = 'one-to-one',
): Conversation {
  return Conversation.fromPrimitives({
    adminIds: [],
    creatorId: 'identity-a',
    id,
    latestMessageAt,
    name: type === 'group' ? 'Friends' : undefined,
    networkId: 'network-a',
    participantIds: ['identity-a', 'identity-b'],
    type,
  });
}

describe('conversation use cases', () => {
  let conversationRepository: MockProxy<ConversationRepository>;
  let readReceiptRepository: MockProxy<ConversationReadReceiptRepository>;

  beforeEach(() => {
    conversationRepository = mock<ConversationRepository>();
    readReceiptRepository = mock<ConversationReadReceiptRepository>();
  });

  it('creates a direct conversation through its repository', async () => {
    const created = conversation('one-to-one:a', 0);

    conversationRepository.create.mockResolvedValue(created);

    await expect(
      new ConversationCreator(
        conversationRepository,
        new ConversationIdFactory(),
      ).create(
        new CreateConversationMessage(
          'network-a',
          'identity-b',
          'identity-a',
          100,
        ),
      ),
    ).resolves.toBe(created);

    const aggregate = conversationRepository.create.mock.calls[0]?.[0];

    expect(aggregate).toBeInstanceOf(Conversation);
    expect(aggregate?.pullDomainEvents()).toEqual([
      expect.objectContaining({ type: 'ConversationCreated' }),
    ]);
  });

  it('keeps a group read on this device without any node request', async () => {
    await new ConversationReadMarker(readReceiptRepository).mark(
      new MarkConversationReadUntilMessage(
        'group:a',
        'message-a',
        'identity-a',
      ),
    );

    expect(readReceiptRepository.markRead).not.toHaveBeenCalled();
  });

  it('sends nothing for a one-to-one conversation that is not open', async () => {
    await new ConversationReadMarker(readReceiptRepository).mark(
      new MarkConversationReadUntilMessage(
        'one-to-one:a',
        'message-a',
        'identity-a',
      ),
    );

    expect(readReceiptRepository.markRead).not.toHaveBeenCalled();
  });

  it('sends a read of the open one-to-one conversation as a read receipt', async () => {
    await new ConversationReadMarker(readReceiptRepository).mark(
      new MarkConversationReadUntilMessage(
        'one-to-one:a',
        'message-a',
        'identity-a',
        { id: 'one-to-one:a', type: 'one-to-one' },
      ),
    );

    const [conversationId, messageId, actorIdentityId] =
      readReceiptRepository.markRead.mock.calls[0] ?? [];

    expect(conversationId?.toString()).toBe('one-to-one:a');
    expect(messageId?.toString()).toBe('message-a');
    expect(actorIdentityId?.toString()).toBe('identity-a');
  });

  it('keeps a group read local while another conversation is open', async () => {
    await new ConversationReadMarker(readReceiptRepository).mark(
      new MarkConversationReadUntilMessage(
        'group:a',
        'message-a',
        'identity-a',
        { id: 'one-to-one:a', type: 'one-to-one' },
      ),
    );

    expect(readReceiptRepository.markRead).not.toHaveBeenCalled();
  });

  it('keeps a read of the open group conversation local', async () => {
    await new ConversationReadMarker(readReceiptRepository).mark(
      new MarkConversationReadUntilMessage(
        'group:a',
        'message-a',
        'identity-a',
        { id: 'group:a', type: 'group' },
      ),
    );

    expect(readReceiptRepository.markRead).not.toHaveBeenCalled();
  });

  it('returns conversations ordered by latest activity', async () => {
    const oldConversation = conversation('one-to-one:old', 100);
    const recentConversation = conversation('one-to-one:recent', 200);

    conversationRepository.searchByIdentity.mockResolvedValue([
      oldConversation,
      recentConversation,
    ]);

    await expect(
      new ConversationsSearcher(conversationRepository).search(
        new SearchConversationsMessage('identity-a'),
      ),
    ).resolves.toEqual([oldConversation, recentConversation]);
  });
});
