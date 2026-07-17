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
        id: 'one-to-one:a',
        networkId: 'network-a',
        participantIds: ['identity-a', 'identity-b'],
        type: 'one-to-one',
      },
      keychain: { conversations: {}, version: 2 },
      keychainExternalIdentifier: 'keychain-b',
    });

    await repository.create(
      Conversation.fromPrimitives({
        id: 'one-to-one:a',
        latestMessageAt: 0,
        latestMessagePreview: undefined,
        name: undefined,
        networkId: 'network-a',
        participantIds: ['identity-a', 'identity-b'],
        peerIdentityId: 'identity-b',
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
        id: 'one-to-one:a',
        latestMessageAt: 100,
        networkId: 'network-a',
        participantIds: ['identity-a', 'identity-b'],
        type: 'one-to-one',
      },
    ]);

    await expect(
      repository.searchByIdentity(
        ConversationParticipantId.fromString('identity-a'),
      ),
    ).resolves.toHaveLength(1);
    expect(messagesGateway.loadMessages).not.toHaveBeenCalled();
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
