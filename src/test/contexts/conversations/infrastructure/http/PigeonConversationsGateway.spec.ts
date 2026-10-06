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
    Pick<
      PigeonConversationCommandsApi,
      | 'addMember'
      | 'create'
      | 'createGroup'
      | 'demoteAdmin'
      | 'frontier'
      | 'leave'
      | 'promoteAdmin'
      | 'removeMember'
    >
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
    addMember: jest.fn(),
    create: jest.fn(),
    createGroup: jest.fn(),
    demoteAdmin: jest.fn(),
    frontier: jest.fn(),
    leave: jest.fn(),
    promoteAdmin: jest.fn(),
    removeMember: jest.fn(),
  } as jest.Mocked<
    Pick<
      PigeonConversationCommandsApi,
      | 'addMember'
      | 'create'
      | 'createGroup'
      | 'demoteAdmin'
      | 'frontier'
      | 'leave'
      | 'promoteAdmin'
      | 'removeMember'
    >
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

  it('delegates group creation with the client nonce', async () => {
    const { commands, gateway } = conversationsDouble();
    const input = {
      name: 'Friends',
      networkId: 'network-1',
      nonce: 'nonce-1',
      participantIds: ['identity-2'],
    };

    await gateway.createGroupConversation(session(), input);

    expect(commands.createGroup).toHaveBeenCalledWith(session(), input);
  });

  it('delegates every roster operation to the signed command API', async () => {
    const { commands, gateway } = conversationsDouble();
    const target = { id: 'group:1', networkId: 'network-1' };

    await gateway.addGroupMember(session(), target, 'identity-2');
    await gateway.removeGroupMember(session(), target, 'identity-2');
    await gateway.leaveGroupConversation(session(), target);
    await gateway.promoteGroupAdmin(session(), target, 'identity-2');
    await gateway.demoteGroupAdmin(session(), target, 'identity-2');
    await gateway.conversationFrontier(session(), 'group:1');

    expect(commands.addMember).toHaveBeenCalledWith(
      session(),
      target,
      'identity-2',
    );
    expect(commands.removeMember).toHaveBeenCalledWith(
      session(),
      target,
      'identity-2',
    );
    expect(commands.leave).toHaveBeenCalledWith(session(), target);
    expect(commands.promoteAdmin).toHaveBeenCalledWith(
      session(),
      target,
      'identity-2',
    );
    expect(commands.demoteAdmin).toHaveBeenCalledWith(
      session(),
      target,
      'identity-2',
    );
    expect(commands.frontier).toHaveBeenCalledWith(session(), 'group:1');
  });
});
