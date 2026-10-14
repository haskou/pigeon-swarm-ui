import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../../contexts/messages/domain/ChatMessage';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { ConversationMessageCommands } from '../../../../../app/presentation/workspace/components/ConversationMessageCommands';

jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    directMessages: { edit: jest.fn() },
    groupMessages: {
      delete: jest.fn(),
      edit: jest.fn(),
      pin: jest.fn(),
      reaction: jest.fn(),
    },
    messages: {
      addReactionTo: jest.fn(),
      delete: jest.fn(),
      pin: jest.fn(),
      removeReactionFrom: jest.fn(),
      unpin: jest.fn(),
    },
  },
}));

const group = jest.mocked(applicationContainer.groupMessages);
const legacy = jest.mocked(applicationContainer.messages);
const direct = jest.mocked(applicationContainer.directMessages);
const session = { identity: { id: 'identity-1' } } as unknown as Session;
const groupConversation = {
  id: 'group-1',
  type: 'group',
} as unknown as ConversationResource;
const directConversation = {
  id: 'direct-1',
  type: 'one-to-one',
} as unknown as ConversationResource;
const edited = { id: 'message-1' } as unknown as ChatMessage;

describe('ConversationMessageCommands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deletes a group message through the group mailbox', async () => {
    await ConversationMessageCommands.delete(
      session,
      groupConversation,
      'message-1',
    );

    expect(group.delete).toHaveBeenCalledWith(
      session,
      groupConversation,
      'message-1',
    );
    expect(legacy.delete).not.toHaveBeenCalled();
  });

  it('deletes a one-to-one message through the messages facade', async () => {
    await ConversationMessageCommands.delete(
      session,
      directConversation,
      'message-1',
    );

    expect(legacy.delete).toHaveBeenCalledWith(
      session,
      directConversation,
      'message-1',
    );
    expect(group.delete).not.toHaveBeenCalled();
  });

  it('edits a group message through the group mailbox', async () => {
    group.edit.mockResolvedValue(edited);

    await expect(
      ConversationMessageCommands.edit(
        session,
        groupConversation,
        'message-1',
        'changed',
      ),
    ).resolves.toBe(edited);

    expect(group.edit).toHaveBeenCalledWith(
      session,
      groupConversation,
      'message-1',
      'changed',
      {},
    );
    expect(direct.edit).not.toHaveBeenCalled();
  });

  it('edits a one-to-one message through the direct mailbox', async () => {
    direct.edit.mockResolvedValue(edited);

    await expect(
      ConversationMessageCommands.edit(
        session,
        directConversation,
        'message-1',
        'changed',
      ),
    ).resolves.toBe(edited);

    expect(direct.edit).toHaveBeenCalledWith(
      session,
      directConversation,
      'message-1',
      'changed',
      {},
    );
    expect(group.edit).not.toHaveBeenCalled();
  });

  it('reacts in a group through the group mailbox', async () => {
    await ConversationMessageCommands.react(
      session,
      groupConversation,
      'message-1',
      '👍',
      'remove',
    );

    expect(group.reaction).toHaveBeenCalledWith(session, groupConversation, {
      action: 'remove',
      emoji: '👍',
      messageId: 'message-1',
    });
    expect(legacy.removeReactionFrom).not.toHaveBeenCalled();
  });

  it('reacts in a one-to-one through the messages facade', async () => {
    await ConversationMessageCommands.react(
      session,
      directConversation,
      'message-1',
      '👍',
      'add',
    );

    expect(legacy.addReactionTo).toHaveBeenCalledWith(
      session,
      directConversation,
      'message-1',
      '👍',
    );
    expect(group.reaction).not.toHaveBeenCalled();
  });

  it('removes a one-to-one reaction through the messages facade', async () => {
    await ConversationMessageCommands.react(
      session,
      directConversation,
      'message-1',
      '👍',
      'remove',
    );

    expect(legacy.removeReactionFrom).toHaveBeenCalledWith(
      session,
      directConversation,
      'message-1',
      '👍',
    );
  });

  it('pins in a group through the group mailbox', async () => {
    await ConversationMessageCommands.pin(
      session,
      groupConversation,
      'message-1',
      'unpin',
    );

    expect(group.pin).toHaveBeenCalledWith(session, groupConversation, {
      action: 'unpin',
      messageId: 'message-1',
    });
    expect(legacy.unpin).not.toHaveBeenCalled();
  });

  it('pins in a one-to-one through the messages facade', async () => {
    await ConversationMessageCommands.pin(
      session,
      directConversation,
      'message-1',
      'pin',
    );

    expect(legacy.pin).toHaveBeenCalledWith(
      session,
      directConversation,
      'message-1',
    );
    expect(group.pin).not.toHaveBeenCalled();
  });

  it('unpins in a one-to-one through the messages facade', async () => {
    await ConversationMessageCommands.pin(
      session,
      directConversation,
      'message-1',
      'unpin',
    );

    expect(legacy.unpin).toHaveBeenCalledWith(
      session,
      directConversation,
      'message-1',
    );
  });
});
