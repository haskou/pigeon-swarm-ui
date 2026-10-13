import { mock, type MockProxy } from 'jest-mock-extended';

import type { PigeonConversationsGateway } from '../../../../../contexts/conversations/infrastructure/http/PigeonConversationsGateway';
import type { PigeonMessagesGateway } from '../../../../../contexts/messages/infrastructure/http/PigeonMessagesGateway';

import { Conversation } from '../../../../../contexts/conversations/domain/Conversation';
import { ConversationNotFoundError } from '../../../../../contexts/conversations/domain/errors/ConversationNotFoundError';
import { ConversationId } from '../../../../../contexts/conversations/domain/value-objects/ConversationId';
import { ConversationParticipantId } from '../../../../../contexts/conversations/domain/value-objects/ConversationParticipantId';
import { ConversationAccessContexts } from '../../../../../contexts/conversations/infrastructure/http/ConversationAccessContexts';
import { ConversationMapper } from '../../../../../contexts/conversations/infrastructure/http/ConversationMapper';
import { PigeonConversationRepository } from '../../../../../contexts/conversations/infrastructure/http/PigeonConversationRepository';
import { sessionFixture } from '../../ConversationFixture';

describe(PigeonConversationRepository.name, () => {
  let contexts: ConversationAccessContexts;
  let gateway: MockProxy<PigeonConversationsGateway>;
  let messagesGateway: MockProxy<PigeonMessagesGateway>;
  let repository: PigeonConversationRepository;

  beforeEach(() => {
    contexts = new ConversationAccessContexts();
    gateway = mock<PigeonConversationsGateway>();
    messagesGateway = mock<PigeonMessagesGateway>();
    repository = new PigeonConversationRepository(
      gateway,
      messagesGateway,
      contexts,
      new ConversationMapper(),
    );
    contexts.register(sessionFixture());
  });

  it('creates a direct conversation and keeps the published keychain', async () => {
    gateway.createConversation.mockResolvedValue({
      conversation: {
        adminIds: [],
        id: 'one-to-one:a',
        networkId: 'network-a',
        participantIds: ['identity-a', 'identity-b'],
        type: 'one-to-one',
        unreadCount: 0,
      },
      keychain: { conversations: {}, version: 2 },
      keychainExternalIdentifier: 'keychain-b',
    });

    await repository.create(
      Conversation.fromPrimitives({
        adminIds: [],
        creatorId: 'identity-a',
        id: 'one-to-one:a',
        latestMessageAt: 0,
        name: undefined,
        networkId: 'network-a',
        participantIds: ['identity-a', 'identity-b'],
        type: 'one-to-one',
        unreadCount: 0,
      }),
      ConversationParticipantId.fromString('identity-a'),
    );

    expect(
      contexts.find(ConversationParticipantId.fromString('identity-a'))
        .keychainExternalIdentifier,
    ).toBe('keychain-b');
  });

  it('searches and maps conversations without reloading known activity', async () => {
    gateway.listConversations.mockResolvedValue([
      {
        adminIds: [],
        id: 'one-to-one:a',
        latestMessageAt: 100,
        networkId: 'network-a',
        participantIds: ['identity-a', 'identity-b'],
        type: 'one-to-one',
        unreadCount: 0,
      },
    ]);

    await expect(
      repository.searchByIdentity(
        ConversationParticipantId.fromString('identity-a'),
      ),
    ).resolves.toHaveLength(1);
    expect(messagesGateway.loadMessages).not.toHaveBeenCalled();
  });

  it('never reads the node message list to recover one-to-one activity', async () => {
    gateway.listConversations.mockResolvedValue([
      {
        adminIds: [],
        id: 'one-to-one:a',
        networkId: 'network-a',
        participantIds: ['identity-a', 'identity-b'],
        type: 'one-to-one',
        unreadCount: 0,
      },
    ]);

    const [conversation] = await repository.searchByIdentity(
      ConversationParticipantId.fromString('identity-a'),
    );

    expect(messagesGateway.loadMessages).not.toHaveBeenCalled();
    expect(conversation?.toPrimitives().latestMessageAt).toBeUndefined();
  });

  it('recovers group activity from the latest group message', async () => {
    gateway.listConversations.mockResolvedValue([
      {
        adminIds: ['identity-a'],
        id: 'group:a',
        name: 'Group',
        networkId: 'network-a',
        participantIds: ['identity-a', 'identity-b', 'identity-c'],
        type: 'group',
        unreadCount: 0,
      },
    ]);
    messagesGateway.loadMessages.mockResolvedValue({
      messages: [{ raw: { createdAt: 250 } }],
    } as never);

    const [conversation] = await repository.searchByIdentity(
      ConversationParticipantId.fromString('identity-a'),
    );

    expect(messagesGateway.loadMessages).toHaveBeenCalledWith(
      expect.anything(),
      'group:a',
      null,
      { limit: 1 },
    );
    expect(conversation?.toPrimitives().latestMessageAt).toBe(250);
  });

  it('fails explicitly when a conversation cannot be found', async () => {
    gateway.listConversations.mockResolvedValue([]);

    await expect(
      repository.find(
        ConversationId.fromString('one-to-one:missing'),
        ConversationParticipantId.fromString('identity-a'),
      ),
    ).rejects.toThrow(ConversationNotFoundError);
  });
});
