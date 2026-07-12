import type {
  ChatMessage,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { PigeonMessageCommandsApi } from './PigeonMessageCommandsApi';
import { PigeonMessagesApi } from './PigeonMessagesApi';
import { PigeonMessagesGateway } from './PigeonMessagesGateway';

describe(PigeonMessagesGateway.name, () => {
  const session = { identity: { id: 'identity-1' } } as unknown as Session;

  it('routes message commands to command infrastructure', async () => {
    const sent = { id: 'message-1' } as ChatMessage;
    const commands = {
      delete: jest.fn().mockResolvedValue(undefined),
      edit: jest.fn().mockResolvedValue(sent),
      send: jest.fn().mockResolvedValue(sent),
    } as unknown as PigeonMessageCommandsApi;
    const gateway = new PigeonMessagesGateway(
      {} as PigeonMessagesApi,
      commands,
    );

    await expect(
      gateway.sendMessage(session, 'conversation-1', 'Hello'),
    ).resolves.toBe(sent);
    await expect(
      gateway.editMessage(session, 'conversation-1', 'message-1', 'Updated'),
    ).resolves.toBe(sent);
    await gateway.deleteMessage(session, 'conversation-1', 'message-1');

    expect(commands.send).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'Hello',
      {},
    );
    expect(commands.edit).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'message-1',
      'Updated',
      {},
    );
    expect(commands.delete).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'message-1',
    );
  });

  it('routes message reads and reactions to read infrastructure', async () => {
    const message = { id: 'message-1' } as ChatMessage;
    const reads = {
      addMessageReaction: jest.fn().mockResolvedValue(undefined),
      createLinkPreview: jest.fn().mockResolvedValue({}),
      decryptMessage: jest.fn().mockResolvedValue(message),
      deleteConversationDraft: jest.fn().mockResolvedValue(undefined),
      listConversationDrafts: jest.fn().mockResolvedValue([]),
      listMessagePins: jest.fn().mockResolvedValue([]),
      loadMessage: jest.fn().mockResolvedValue(message),
      loadMessages: jest.fn().mockResolvedValue({ messages: [] }),
      loadMessagesAround: jest.fn().mockResolvedValue({ messages: [] }),
      loadMessageThread: jest.fn().mockResolvedValue({ messages: [] }),
      pinMessage: jest.fn().mockResolvedValue(undefined),
      removeMessageReaction: jest.fn().mockResolvedValue(undefined),
      saveConversationDraft: jest.fn().mockResolvedValue({ content: 'draft' }),
      unpinMessage: jest.fn().mockResolvedValue(undefined),
    } as unknown as PigeonMessagesApi;
    const gateway = new PigeonMessagesGateway(
      reads,
      {} as PigeonMessageCommandsApi,
    );
    const resource = { id: 'message-1' };

    await gateway.addMessageReaction(
      session,
      'conversation-1',
      'message-1',
      'heart',
    );
    await gateway.createLinkPreview(session, 'https://example.test');
    await gateway.decryptMessage(session, 'conversation-1', resource);
    await gateway.deleteConversationDraft(session, 'conversation-1');
    await gateway.listConversationDrafts(session);
    await gateway.listMessagePins(session, 'conversation-1');
    await gateway.loadMessage(session, 'conversation-1', 'message-1');
    await gateway.loadMessageThread(session, 'conversation-1', 'message-1');
    await gateway.loadMessages(session, 'conversation-1');
    await gateway.loadMessagesAround(session, 'conversation-1', 'message-1');
    await gateway.pinMessage(session, 'conversation-1', 'message-1');
    await gateway.removeMessageReaction(
      session,
      'conversation-1',
      'message-1',
      'heart',
    );
    await gateway.saveConversationDraft(session, 'conversation-1', 'draft');
    await gateway.unpinMessage(session, 'conversation-1', 'message-1');

    expect(reads.addMessageReaction).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'message-1',
      'heart',
    );
    expect(reads.createLinkPreview).toHaveBeenCalledWith(
      session,
      'https://example.test',
    );
    expect(reads.decryptMessage).toHaveBeenCalledWith(
      session,
      'conversation-1',
      resource,
    );
    expect(reads.loadMessages).toHaveBeenCalledWith(
      session,
      'conversation-1',
      undefined,
      {},
    );
    expect(reads.saveConversationDraft).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'draft',
      undefined,
    );
  });
});
