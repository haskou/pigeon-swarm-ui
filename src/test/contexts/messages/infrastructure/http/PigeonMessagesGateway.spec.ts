import type { PigeonMessageCommandsApi } from '../../../../../contexts/messages/infrastructure/http/PigeonMessageCommandsApi';
import type { PigeonMessagesApi } from '../../../../../contexts/messages/infrastructure/http/PigeonMessagesApi';
import type {
  ChatMessage,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { PigeonMessagesGateway } from '../../../../../contexts/messages/infrastructure/http/PigeonMessagesGateway';

function session(): Session {
  return {
    identity: { id: 'identity-1' },
    keychain: { conversations: {}, version: 1 },
  } as unknown as Session;
}

function messagesDouble(): {
  commands: jest.Mocked<
    Pick<PigeonMessageCommandsApi, 'delete' | 'edit' | 'send'>
  >;
  gateway: PigeonMessagesGateway;
  messages: jest.Mocked<
    Pick<
      PigeonMessagesApi,
      'addMessageReaction' | 'loadMessages' | 'removeMessageReaction'
    >
  >;
} {
  const messages = {
    addMessageReaction: jest.fn(),
    loadMessages: jest.fn(),
    removeMessageReaction: jest.fn(),
  } as jest.Mocked<
    Pick<
      PigeonMessagesApi,
      'addMessageReaction' | 'loadMessages' | 'removeMessageReaction'
    >
  >;
  const commands = {
    delete: jest.fn(),
    edit: jest.fn(),
    send: jest.fn(),
  } as jest.Mocked<Pick<PigeonMessageCommandsApi, 'delete' | 'edit' | 'send'>>;

  return {
    commands,
    gateway: new PigeonMessagesGateway(
      messages as unknown as PigeonMessagesApi,
      commands as unknown as PigeonMessageCommandsApi,
    ),
    messages,
  };
}

describe(PigeonMessagesGateway.name, () => {
  it('delegates message reads to the messages infrastructure API', async () => {
    const { gateway, messages } = messagesDouble();
    const result = { messages: [] as ChatMessage[], nextCursor: null };
    messages.loadMessages.mockResolvedValue(result);

    await expect(
      gateway.loadMessages(session(), 'conversation-1', 'before-1', {
        limit: 20,
      }),
    ).resolves.toBe(result);
    expect(messages.loadMessages).toHaveBeenCalledWith(
      session(),
      'conversation-1',
      'before-1',
      { limit: 20 },
    );
  });

  it('delegates message commands to the command API', async () => {
    const { commands, gateway } = messagesDouble();
    const created = {} as ChatMessage;
    commands.send.mockResolvedValue(created);

    await expect(
      gateway.sendMessage(session(), 'conversation-1', 'hello'),
    ).resolves.toBe(created);
    expect(commands.send).toHaveBeenCalledWith(
      session(),
      'conversation-1',
      'hello',
      {},
    );
  });
});
