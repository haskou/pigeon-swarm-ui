import type { PigeonConversationCommandsApi } from '../../../../../contexts/conversations/infrastructure/http/PigeonConversationCommandsApi';
import type { PigeonConversationsApi } from '../../../../../contexts/conversations/infrastructure/http/PigeonConversationsApi';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PigeonConversationsGateway } from '../../../../../contexts/conversations/infrastructure/http/PigeonConversationsGateway';

function session(): Session {
  return {
    identity: { id: 'identity-1' },
    keychain: { conversations: {}, version: 1 },
  } as unknown as Session;
}

function conversationsDouble(): {
  commands: jest.Mocked<
    Pick<PigeonConversationCommandsApi, 'create' | 'createGroup' | 'invite'>
  >;
  gateway: PigeonConversationsGateway;
  conversations: jest.Mocked<
    Pick<PigeonConversationsApi, 'list' | 'markReadUntil'>
  >;
} {
  const conversations = {
    list: jest.fn(),
    markReadUntil: jest.fn(),
  } as jest.Mocked<Pick<PigeonConversationsApi, 'list' | 'markReadUntil'>>;
  const commands = {
    create: jest.fn(),
    createGroup: jest.fn(),
    invite: jest.fn(),
  } as jest.Mocked<
    Pick<PigeonConversationCommandsApi, 'create' | 'createGroup' | 'invite'>
  >;

  return {
    commands,
    conversations,
    gateway: new PigeonConversationsGateway(
      conversations as unknown as PigeonConversationsApi,
      commands as unknown as PigeonConversationCommandsApi,
    ),
  };
}

describe(PigeonConversationsGateway.name, () => {
  it('delegates conversation creation to the command API', async () => {
    const { commands, gateway } = conversationsDouble();
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

  it('uses the group invitation contract when inviting a member', async () => {
    const { commands, gateway } = conversationsDouble();

    await gateway.inviteToGroupConversation(session(), 'group-1', 'identity-2');

    expect(commands.invite).toHaveBeenCalledWith(
      session(),
      'group-1',
      'identity-2',
      'group_conversation_invitation',
    );
  });
});
