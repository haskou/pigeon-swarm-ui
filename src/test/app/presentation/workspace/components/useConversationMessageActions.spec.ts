import type { SetStateAction } from 'react';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type { EditingMessage } from '../../../../../app/presentation/workspace/components/conversationThreadState';
import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { MessageResource } from '../../../../../contexts/messages/infrastructure/http/MessageResource';
import type { ChatMessage } from '../../../../../contexts/messages/presentation/view-models/ChatMessage';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useConversationMessageActions } from '../../../../../app/presentation/workspace/components/useConversationMessageActions';
import { copy } from '../../../../../shared/presentation/i18n/copy';

jest.mock('react', () => ({
  startTransition: (callback: () => void) => callback(),
  useCallback: <T>(callback: T) => callback,
  useRef: <T>(initial: T) => ({ current: initial }),
  useState: <T>(initial: T) => [initial, jest.fn()],
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    directMessages: {
      delete: jest.fn(),
      edit: jest.fn(),
      reaction: jest.fn(),
    },
    groupMessages: {
      delete: jest.fn(),
      edit: jest.fn(),
      reaction: jest.fn(),
    },
    messages: {
      addReactionTo: jest.fn(),
      delete: jest.fn(),
      removeReactionFrom: jest.fn(),
    },
  },
}));

const directDelete = jest.mocked(applicationContainer.directMessages.delete);
const directEdit = jest.mocked(applicationContainer.directMessages.edit);
const directReaction = jest.mocked(
  applicationContainer.directMessages.reaction,
);
const deleteUseCase = jest.mocked(applicationContainer.messages.delete);
const groupDelete = jest.mocked(applicationContainer.groupMessages.delete);
const groupEdit = jest.mocked(applicationContainer.groupMessages.edit);
const groupReaction = jest.mocked(applicationContainer.groupMessages.reaction);
const addReactionUseCase = jest.mocked(
  applicationContainer.messages.addReactionTo,
);
const removeReactionUseCase = jest.mocked(
  applicationContainer.messages.removeReactionFrom,
);
const now = 1_700_000_000_000;

const session = { identity: { id: 'identity-1' } } as unknown as Session;
const conversation = {
  id: 'conversation-1',
  networkId: 'network-1',
  type: 'one-to-one',
} as unknown as ConversationResource;
const groupConversation = {
  id: 'conversation-2',
  networkId: 'network-1',
  type: 'group',
} as unknown as ConversationResource;
const target = {
  attachments: [],
  authorIdentityId: 'identity-1',
  content: 'hello',
  encrypted: false,
  id: 'message-1',
  mine: true,
  raw: {
    conversationId: 'conversation-1',
    id: 'message-1',
    type: 'sent',
  } as unknown as MessageResource,
  reactions: [],
  timestamp: 2000,
} as unknown as ChatMessage;
const editEvent = {
  content: 'changed',
  encrypted: false,
  id: 'edit-1',
  raw: {
    id: 'edit-1',
    targetMessageId: 'message-1',
    type: 'edited',
  },
  timestamp: 3000,
} as unknown as ChatMessage;

function mountActions({
  activeConversation = conversation,
  editingMessage = null,
  messages: initialMessages = [target],
}: {
  activeConversation?: ConversationResource;
  editingMessage?: EditingMessage | null;
  messages?: ChatMessage[];
} = {}) {
  const state: { error: string | null; messages: ChatMessage[] } = {
    error: null,
    messages: initialMessages,
  };
  const messagesRef = { current: state.messages };
  const onErrorChange = jest.fn((error: string | null) => {
    state.error = error;
  });
  const onMessagesChange = jest.fn((update: SetStateAction<ChatMessage[]>) => {
    state.messages =
      typeof update === 'function' ? update(state.messages) : update;
    messagesRef.current = state.messages;
  });
  const onEditingMessageChange = jest.fn();
  const updateActiveConversationDraft = jest.fn();
  const actions = useConversationMessageActions({
    activeConversation,
    activeConversationDraft: '',
    editingMessage,
    messages: state.messages,
    messagesRef,
    onAttachmentProgressChange: jest.fn(),
    onConversationsChange: jest.fn(),
    onDraftsChange: jest.fn(),
    onEditingMessageChange,
    onErrorChange,
    onMessageContextMenuChange: jest.fn(),
    onMessagesChange,
    onReplyTargetChange: jest.fn(),
    replyTarget: null,
    scrollerRef: { current: null },
    scrollToBottom: jest.fn(),
    session,
    updateActiveConversationDraft,
  });

  return {
    ...actions,
    onEditingMessageChange,
    state,
    updateActiveConversationDraft,
  };
}

describe('useConversationMessageActions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('delete', () => {
    it('deletes a one-to-one message through the messages use cases only', async () => {
      deleteUseCase.mockResolvedValue(undefined);
      const actions = mountActions();

      await actions.deleteMessage(target);

      expect(deleteUseCase).toHaveBeenCalledWith(
        session,
        conversation,
        'message-1',
      );
      expect(directDelete).not.toHaveBeenCalled();
      expect(actions.state.messages).toEqual([]);
    });

    it('keeps the message and shows the delete error when the delete rejects', async () => {
      deleteUseCase.mockRejectedValue(new Error('delete refused'));
      const actions = mountActions();

      await actions.deleteMessage(target);

      expect(actions.state.error).toBe('delete refused');
      expect(actions.state.messages).toEqual([target]);
    });

    it('deletes a group message through the group mailbox only', async () => {
      groupDelete.mockResolvedValue(undefined);
      const actions = mountActions({ activeConversation: groupConversation });

      await actions.deleteMessage(target);

      expect(groupDelete).toHaveBeenCalledWith(
        session,
        groupConversation,
        'message-1',
      );
      expect(deleteUseCase).not.toHaveBeenCalled();
      expect(directDelete).not.toHaveBeenCalled();
      expect(actions.state.messages).toEqual([]);
    });
  });

  describe('edit', () => {
    it('edits a one-to-one message through the mailbox only', async () => {
      directEdit.mockResolvedValue(editEvent);
      const actions = mountActions({
        editingMessage: { message: target, previousDraft: '' },
      });

      await actions.editMessage('changed');

      expect(directEdit).toHaveBeenCalledWith(
        session,
        conversation,
        'message-1',
        'changed',
        {},
      );
      expect(groupEdit).not.toHaveBeenCalled();
      expect(actions.onEditingMessageChange).toHaveBeenCalledWith(null);
      expect(actions.updateActiveConversationDraft).toHaveBeenCalledWith('');
    });

    it('edits a group message through the group mailbox only', async () => {
      groupEdit.mockResolvedValue(editEvent);
      const actions = mountActions({
        activeConversation: groupConversation,
        editingMessage: { message: target, previousDraft: '' },
      });

      await actions.editMessage('changed');

      expect(groupEdit).toHaveBeenCalledWith(
        session,
        groupConversation,
        'message-1',
        'changed',
        {},
      );
      expect(directEdit).not.toHaveBeenCalled();
      expect(actions.onEditingMessageChange).toHaveBeenCalledWith(null);
    });

    it('keeps the edit open and shows the edit error when the mailbox edit rejects', async () => {
      directEdit.mockRejectedValue(new Error('edit refused'));
      const actions = mountActions({
        editingMessage: { message: target, previousDraft: '' },
      });

      await actions.editMessage('changed');

      expect(groupEdit).not.toHaveBeenCalled();
      expect(actions.state.error).toBe('edit refused');
      expect(actions.onEditingMessageChange).not.toHaveBeenCalledWith(null);
    });
  });

  describe('reaction', () => {
    it('adds a one-to-one reaction through the messages use cases only', async () => {
      addReactionUseCase.mockResolvedValue(undefined);
      const actions = mountActions();

      await actions.toggleReaction(target, '👍', false);

      expect(addReactionUseCase).toHaveBeenCalledWith(
        session,
        conversation,
        'message-1',
        '👍',
      );
      expect(directReaction).not.toHaveBeenCalled();
    });

    it('removes a one-to-one reaction through the messages use cases only', async () => {
      removeReactionUseCase.mockResolvedValue(undefined);
      const reacted = {
        ...target,
        reactions: [
          {
            authorIdentityId: 'identity-1',
            createdAt: 1000,
            emoji: '👍',
          },
        ],
      } as unknown as ChatMessage;
      const actions = mountActions({ messages: [reacted] });

      await actions.toggleReaction(reacted, '👍', true);

      expect(removeReactionUseCase).toHaveBeenCalledWith(
        session,
        conversation,
        'message-1',
        '👍',
      );
      expect(directReaction).not.toHaveBeenCalled();
    });

    it('shows the reaction error when the reaction rejects', async () => {
      addReactionUseCase.mockRejectedValue(new Error('reaction refused'));
      const actions = mountActions();

      await actions.toggleReaction(target, '👍', false);

      expect(actions.state.error).toBe('reaction refused');
    });

    it('adds a group reaction through the group mailbox only', async () => {
      groupReaction.mockResolvedValue(undefined);
      const actions = mountActions({ activeConversation: groupConversation });

      await actions.toggleReaction(target, '👍', false);

      expect(groupReaction).toHaveBeenCalledWith(session, groupConversation, {
        action: 'add',
        createdAt: now,
        emoji: '👍',
        messageId: 'message-1',
      });
      expect(addReactionUseCase).not.toHaveBeenCalled();
    });

    it('restores the group reaction when the group reaction rejects', async () => {
      groupReaction.mockRejectedValue(new Error('reaction refused'));
      const actions = mountActions({ activeConversation: groupConversation });

      await actions.toggleReaction(target, '👍', false);

      expect(actions.state.error).toBe('reaction refused');
      expect(actions.state.messages).toEqual([
        expect.objectContaining({ id: 'message-1', reactions: [] }),
      ]);
    });
  });

  describe('reply reference', () => {
    it('reports a reply target missing from the local timeline', () => {
      const actions = mountActions({ messages: [] });

      actions.openReplyReference('missing-1');

      expect(actions.state.error).toBe(copy.messages.replyTargetNotFound);
    });

    it('reports a group reply target missing from the local timeline', () => {
      const actions = mountActions({
        activeConversation: groupConversation,
        messages: [],
      });

      actions.openReplyReference('missing-1');

      expect(actions.state.error).toBe(copy.messages.replyTargetNotFound);
    });
  });
});
