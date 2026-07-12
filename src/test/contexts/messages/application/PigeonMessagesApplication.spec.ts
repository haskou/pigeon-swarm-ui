import type {
  ChatMessage,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { PigeonMessagesApplication } from '../../../../contexts/messages/application/PigeonMessagesApplication';

type Dependencies = ConstructorParameters<typeof PigeonMessagesApplication>[0];

describe(PigeonMessagesApplication.name, () => {
  function dependenciesDouble(): Dependencies {
    return {
      addMessageReaction: { addMessageReaction: jest.fn() },
      createLinkPreview: { createLinkPreview: jest.fn() },
      decryptMessage: { decryptMessage: jest.fn() },
      deleteConversationDraft: { deleteConversationDraft: jest.fn() },
      deleteMessage: { deleteMessage: jest.fn() },
      editMessage: { editMessage: jest.fn() },
      listConversationDrafts: { listConversationDrafts: jest.fn() },
      listMessagePins: { listMessagePins: jest.fn() },
      loadMessage: { loadMessage: jest.fn() },
      loadMessages: { loadMessages: jest.fn() },
      loadMessagesAround: { loadMessagesAround: jest.fn() },
      loadMessageThread: { loadMessageThread: jest.fn() },
      pinMessage: { pinMessage: jest.fn() },
      removeMessageReaction: { removeMessageReaction: jest.fn() },
      saveConversationDraft: { saveConversationDraft: jest.fn() },
      sendMessage: { sendMessage: jest.fn() },
      unpinMessage: { unpinMessage: jest.fn() },
    };
  }

  const session = {
    identity: { id: 'identity-1' },
  } as unknown as Session;

  it('sends messages through the message application boundary', async () => {
    const dependencies = dependenciesDouble();
    const sent = { id: 'message-1' } as ChatMessage;
    const sendMessage = dependencies.sendMessage.sendMessage as jest.Mock;
    sendMessage.mockResolvedValue(sent);
    const application = new PigeonMessagesApplication(dependencies);

    await expect(
      application.send(session, 'conversation-1', 'Hello'),
    ).resolves.toBe(sent);
    expect(dependencies.sendMessage.sendMessage).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'Hello',
      {},
    );
  });

  it('loads paginated messages through the load use case', async () => {
    const dependencies = dependenciesDouble();
    const result = { messages: [], nextCursor: null };
    const loadMessages = dependencies.loadMessages.loadMessages as jest.Mock;
    loadMessages.mockResolvedValue(result);
    const application = new PigeonMessagesApplication(dependencies);

    await expect(
      application.load(session, 'conversation-1', 'message-20', {
        limit: 20,
      }),
    ).resolves.toBe(result);
    expect(dependencies.loadMessages.loadMessages).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'message-20',
      { limit: 20 },
    );
  });

  it('adds reactions through validated message identifiers', async () => {
    const dependencies = dependenciesDouble();
    const application = new PigeonMessagesApplication(dependencies);

    await application.addReactionTo(
      session,
      'conversation-1',
      'message-1',
      'heart',
    );

    expect(
      dependencies.addMessageReaction.addMessageReaction,
    ).toHaveBeenCalledWith(session, 'conversation-1', 'message-1', 'heart');
  });
});
