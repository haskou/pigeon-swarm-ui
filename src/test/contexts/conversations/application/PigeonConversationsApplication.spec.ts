import type {
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { PigeonConversationsApplication } from '../../../../contexts/conversations/application/PigeonConversationsApplication';

type Dependencies = ConstructorParameters<
  typeof PigeonConversationsApplication
>[0];

describe(PigeonConversationsApplication.name, () => {
  function dependenciesDouble(): Dependencies {
    return {
      createConversation: { createConversation: jest.fn() },
      createGroupConversation: { createGroupConversation: jest.fn() },
      inviteToGroupConversation: { inviteToGroupConversation: jest.fn() },
      listConversations: {
        listConversations: jest.fn(),
        loadMessages: jest.fn(),
      },
      markConversationReadUntil: { markConversationReadUntil: jest.fn() },
    };
  }

  const session = {
    identity: { id: 'identity-1' },
  } as unknown as Session;

  it('creates conversations through validated application messages', async () => {
    const dependencies = dependenciesDouble();
    const created = {
      conversation: { id: 'conversation-1', networkId: 'network-1' },
      keychain: { conversations: {}, version: 1 },
      keychainExternalIdentifier: 'keychain-cid',
    };
    const createConversation = dependencies.createConversation
      .createConversation as jest.Mock;
    createConversation.mockResolvedValue(created);
    const application = new PigeonConversationsApplication(dependencies);

    await expect(
      application.create(session, 'identity-2', 'network-1'),
    ).resolves.toBe(created);
    expect(createConversation).toHaveBeenCalledWith(
      session,
      'identity-2',
      'network-1',
    );
  });

  it('lists conversations through the timeline use case boundary', async () => {
    const dependencies = dependenciesDouble();
    const conversations = [{ id: 'conversation-1' }] as ConversationResource[];
    const listConversations = dependencies.listConversations
      .listConversations as jest.Mock;
    listConversations.mockResolvedValue(conversations);
    const application = new PigeonConversationsApplication(dependencies);

    await expect(application.list(session)).resolves.toEqual(conversations);
    expect(listConversations).toHaveBeenCalledWith(session);
  });

  it('marks the explicit message boundary as read', async () => {
    const dependencies = dependenciesDouble();
    const application = new PigeonConversationsApplication(dependencies);

    await application.markReadUntil(session, 'conversation-1', 'message-1');

    expect(
      dependencies.markConversationReadUntil.markConversationReadUntil,
    ).toHaveBeenCalledWith(session, 'conversation-1', 'message-1');
  });
});
