import type {
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { PigeonMessagesApi } from '../../../messages/infrastructure/http/PigeonMessagesApi';
import { PigeonConversationCommandsApi } from './PigeonConversationCommandsApi';
import { PigeonConversationsApi } from './PigeonConversationsApi';
import { PigeonConversationsGateway } from './PigeonConversationsGateway';

describe(PigeonConversationsGateway.name, () => {
  const session = { identity: { id: 'identity-1' } } as unknown as Session;

  it('coordinates conversation commands and read transport', async () => {
    const created = {
      conversation: { id: 'conversation-1' } as ConversationResource,
      keychain: { conversations: {}, version: 1 },
      keychainExternalIdentifier: 'keychain-1',
    };
    const commands = {
      create: jest.fn().mockResolvedValue(created),
      createGroup: jest.fn().mockResolvedValue(created),
      invite: jest.fn().mockResolvedValue(undefined),
    } as unknown as PigeonConversationCommandsApi;
    const conversations = {
      list: jest.fn().mockResolvedValue([]),
      markReadUntil: jest.fn().mockResolvedValue(undefined),
    } as unknown as PigeonConversationsApi;
    const messages = {
      loadMessages: jest.fn().mockResolvedValue({ messages: [] }),
    } as unknown as PigeonMessagesApi;
    const gateway = new PigeonConversationsGateway(
      commands,
      conversations,
      messages,
    );

    await expect(
      gateway.createConversation(session, 'identity-2', 'network-1'),
    ).resolves.toBe(created);
    await expect(
      gateway.createGroupConversation(session, {
        name: 'Crew',
        networkId: 'network-1',
        participantIds: ['identity-2'],
      }),
    ).resolves.toBe(created);
    await gateway.createGroupConversationInvitation(
      session,
      'conversation-1',
      'identity-2',
    );
    await expect(gateway.listConversations(session)).resolves.toEqual([]);
    await expect(
      gateway.loadMessages(session, 'conversation-1', null, { limit: 1 }),
    ).resolves.toEqual({ messages: [] });
    await gateway.markConversationReadUntil(
      session,
      'conversation-1',
      'message-1',
    );

    expect(commands.create).toHaveBeenCalledWith(
      session,
      'identity-2',
      'network-1',
    );
    expect(commands.createGroup).toHaveBeenCalledWith(session, {
      name: 'Crew',
      networkId: 'network-1',
      participantIds: ['identity-2'],
    });
    expect(commands.invite).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'identity-2',
    );
    expect(conversations.list).toHaveBeenCalledWith(session);
    expect(messages.loadMessages).toHaveBeenCalledWith(
      session,
      'conversation-1',
      null,
      { limit: 1 },
    );
    expect(conversations.markReadUntil).toHaveBeenCalledWith(
      session,
      'conversation-1',
      'message-1',
    );
  });
});
