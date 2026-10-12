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
import type {
  ChatMessage,
  ConversationResource,
  MessageResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

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
    messages: {
      addReactionTo: jest.fn(),
      delete: jest.fn(),
      edit: jest.fn(),
      loadAround: jest.fn(),
      removeReactionFrom: jest.fn(),
    },
  },
}));

const directDelete = jest.mocked(applicationContainer.directMessages.delete);
const directEdit = jest.mocked(applicationContainer.directMessages.edit);
const directReaction = jest.mocked(applicationContainer.directMessages.reaction);
const deleteLegacy = jest.mocked(applicationContainer.messages.delete);
const editLegacy = jest.mocked(applicationContainer.messages.edit);
const addReactionLegacy = jest.mocked(
  applicationContainer.messages.addReactionTo,
);
const removeReactionLegacy = jest.mocked(
  applicationContainer.messages.removeReactionFrom,
);
const loadAroundLegacy = jest.mocked(applicationContainer.messages.loadAround);

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
const createdAt = 1_700_000_000_000;

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
    activeConversationKeyAvailable: true,
    editingMessage,
    messages: state.messages,
    messagesRef,
    onAttachmentProgressChange: jest.fn(),
    onConversationsChange: jest.fn(),
    onDraftsChange: jest.fn(),
    onEditingMessageChange,
    onErrorChange,
    onMessageContextMenuChange: jest.fn(),
    onMessageCursorChange: jest.fn(),
    onMessageLoadStateChange: jest.fn(),
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

describe('useConversationMessageActions one-to-one mailbox', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('delete', () => {
    it('deletes a one-to-one message through the mailbox only', async () => {
      directDelete.mockResolvedValue(undefined);
      const actions = mountActions();

      await actions.deleteMessage(target);

      expect(directDelete).toHaveBeenCalledWith(
        session,
        conversation,
        'message-1',
      );
      expect(deleteLegacy).not.toHaveBeenCalled();
      expect(actions.state.messages).toEqual([]);
    });

    it('keeps the message and shows the delete error when the mailbox delete rejects', async () => {
      directDelete.mockRejectedValue(new Error('delete refused'));
      const actions = mountActions();

      await actions.deleteMessage(target);

      expect(deleteLegacy).not.toHaveBeenCalled();
      expect(actions.state.error).toBe('delete refused');
      expect(actions.state.messages).toEqual([target]);
    });

    it('deletes a group message through the legacy endpoint only', async () => {
      deleteLegacy.mockResolvedValue(undefined);
      const actions = mountActions({ activeConversation: groupConversation });

      await actions.deleteMessage(target);

      expect(deleteLegacy).toHaveBeenCalledWith(
        session,
        groupConversation.id,
        'message-1',
      );
      expect(directDelete).not.toHaveBeenCalled();
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
      expect(editLegacy).not.toHaveBeenCalled();
      expect(actions.onEditingMessageChange).toHaveBeenCalledWith(null);
      expect(actions.updateActiveConversationDraft).toHaveBeenCalledWith('');
    });

    it('keeps the edit open and shows the edit error when the mailbox edit rejects', async () => {
      directEdit.mockRejectedValue(new Error('edit refused'));
      const actions = mountActions({
        editingMessage: { message: target, previousDraft: '' },
      });

      await actions.editMessage('changed');

      expect(editLegacy).not.toHaveBeenCalled();
      expect(actions.state.error).toBe('edit refused');
      expect(actions.onEditingMessageChange).not.toHaveBeenCalledWith(null);
    });
  });

  describe('reaction', () => {
    it('adds a one-to-one reaction through the mailbox only', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(createdAt);
      directReaction.mockResolvedValue(undefined);
      const actions = mountActions();

      await actions.toggleReaction(target, '👍', false);

      expect(directReaction).toHaveBeenCalledWith(session, conversation, {
        action: 'add',
        createdAt,
        emoji: '👍',
        messageId: 'message-1',
      });
      expect(addReactionLegacy).not.toHaveBeenCalled();
    });

    it('removes a one-to-one reaction through the mailbox only', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(createdAt);
      directReaction.mockResolvedValue(undefined);
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

      expect(directReaction).toHaveBeenCalledWith(session, conversation, {
        action: 'remove',
        createdAt,
        emoji: '👍',
        messageId: 'message-1',
      });
      expect(removeReactionLegacy).not.toHaveBeenCalled();
    });

    it('shows the reaction error when the mailbox reaction rejects', async () => {
      directReaction.mockRejectedValue(new Error('reaction refused'));
      const actions = mountActions();

      await actions.toggleReaction(target, '👍', false);

      expect(addReactionLegacy).not.toHaveBeenCalled();
      expect(actions.state.error).toBe('reaction refused');
    });
  });

  describe('reply reference', () => {
    it('does not load a one-to-one reply target from the legacy endpoint', async () => {
      const actions = mountActions({ messages: [] });

      await actions.openReplyReference('missing-1');

      expect(loadAroundLegacy).not.toHaveBeenCalled();
      expect(actions.state.error).toBe(copy.messages.replyTargetNotFound);
    });
  });
});
