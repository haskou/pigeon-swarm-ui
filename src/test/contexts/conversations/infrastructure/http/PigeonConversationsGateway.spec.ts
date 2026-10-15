import type { PigeonConversationCommandsApi } from '../../../../../contexts/conversations/infrastructure/http/PigeonConversationCommandsApi';
import type { PigeonConversationsApi } from '../../../../../contexts/conversations/infrastructure/http/PigeonConversationsApi';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { PigeonConversationsGateway } from '../../../../../contexts/conversations/infrastructure/http/PigeonConversationsGateway';

function session(): Session {
  return {
    identity: { id: 'identity-1' },
    keychain: { conversations: {}, version: 1 },
  } as unknown as Session;
}

describe(PigeonConversationsGateway.name, () => {
  it('delegates conversation creation to the command API', async () => {
    const conversations = { list: jest.fn() };
    const commands = { create: jest.fn() };
    const gateway = new PigeonConversationsGateway(
      conversations as unknown as PigeonConversationsApi,
      commands as unknown as PigeonConversationCommandsApi,
    );
    const result = {
      conversation: {} as never,
      keychain: {} as never,
      keychainExternalIdentifier: 'keychain-1',
    };
    commands.create.mockResolvedValue(result);

    await expect(
      gateway.createConversation(session(), 'identity-2', 'network-1'),
    ).resolves.toBe(result);
    expect(commands.create).toHaveBeenCalledWith(
      session(),
      'identity-2',
      'network-1',
    );
  });
});
