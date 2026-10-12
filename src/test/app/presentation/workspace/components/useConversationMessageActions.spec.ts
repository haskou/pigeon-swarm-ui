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
import { captureUnhandledRejections } from '../../../../captureUnhandledRejections';

jest.mock('react', () => ({
  startTransition: (callback: () => void) => callback(),
  useCallback: <T>(callback: T) => callback,
  useRef: <T>(initial: T) => ({ current: initial }),
  useState: <T>(initial: T) => [initial, jest.fn()],
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    directMessages: {
      deliverDelete: jest.fn(),
      deliverEdit: jest.fn(),
      deliverReaction: jest.fn(),
    },
    messages: {
      addReactionTo: jest.fn(),
      delete: jest.fn(),
      edit: jest.fn(),
      removeReactionFrom: jest.fn(),
    },
  },
}));

const deleteLegacy = jest.mocked(applicationContainer.messages.delete);
const editLegacy = jest.mocked(applicationContainer.messages.edit);
const addReactionLegacy = jest.mocked(
  applicationContainer.messages.addReactionTo,
);
const removeReactionLegacy = jest.mocked(
  applicationContainer.messages.removeReactionFrom,
);
const deliverDelete = jest.mocked(
  applicationContainer.directMessages.deliverDelete,
);
const deliverEdit = jest.mocked(
  applicationContainer.directMessages.deliverEdit,
);
const deliverReaction = jest.mocked(
  applicationContainer.directMessages.deliverReaction,
);

const session = { identity: { id: 'identity-1' } } as unknown as Session;
const conversation = {
  id: 'conversation-1',
  networkId: 'network-1',
  type: 'one-to-one',
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
const editRaw = {
  conversationId: 'conversation-1',
  id: 'edit-1',
  targetMessageId: 'message-1',
  type: 'edited',
} as unknown as MessageResource;
const editEvent = {
  content: 'changed',
  encrypted: false,
  id: 'edit-1',
  raw: editRaw,
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

describe('useConversationMessageActions inbox delivery', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('delete', () => {
    it('delivers the delete to the active conversation after the legacy delete resolves', async () => {
      deleteLegacy.mockResolvedValue(undefined);
      const actions = mountActions();

      await actions.deleteMessage(target);

      expect(deleteLegacy).toHaveBeenCalledWith(
        session,
        conversation.id,
        'message-1',
      );
      expect(deliverDelete).toHaveBeenCalledWith(
        session,
        conversation,
        'message-1',
      );
      expect(deliverDelete.mock.calls[0]?.[1]).toBe(conversation);
      expect(deliverDelete.mock.invocationCallOrder[0]).toBeGreaterThan(
        deleteLegacy.mock.invocationCallOrder[0] ?? Infinity,
      );
    });

    it('does not deliver the delete when the legacy delete fails', async () => {
      deleteLegacy.mockRejectedValue(new Error('delete refused'));
      const actions = mountActions();

      await actions.deleteMessage(target);

      expect(deliverDelete).not.toHaveBeenCalled();
      expect(actions.state.error).toBe('delete refused');
    });

    it('keeps the delete applied when inbox delivery throws synchronously', async () => {
      deleteLegacy.mockResolvedValue(undefined);
      deliverDelete.mockImplementation(() => {
        throw new Error('inbox unavailable');
      });
      const actions = mountActions();

      await actions.deleteMessage(target);

      expect(actions.state.error).toBeNull();
      expect(actions.state.messages).toEqual([]);
    });

    it('keeps the delete applied with no unhandled rejection when inbox delivery rejects', async () => {
      deleteLegacy.mockResolvedValue(undefined);
      deliverDelete.mockRejectedValue(new Error('inbox unavailable'));
      const actions = mountActions();

      const unhandled = await captureUnhandledRejections(() =>
        actions.deleteMessage(target),
      );

      expect(unhandled).toEqual([]);
      expect(actions.state.error).toBeNull();
      expect(actions.state.messages).toEqual([]);
    });
  });

  describe('edit', () => {
    it('delivers the edited record to the active conversation after the legacy edit resolves', async () => {
      editLegacy.mockResolvedValue(editEvent);
      const actions = mountActions({
        editingMessage: { message: target, previousDraft: '' },
      });

      await actions.editMessage('changed');

      expect(editLegacy).toHaveBeenCalledWith(
        session,
        conversation.id,
        'message-1',
        'changed',
      );
      expect(deliverEdit).toHaveBeenCalledWith(session, conversation, editRaw);
      expect(deliverEdit.mock.calls[0]?.[1]).toBe(conversation);
      expect(deliverEdit.mock.invocationCallOrder[0]).toBeGreaterThan(
        editLegacy.mock.invocationCallOrder[0] ?? Infinity,
      );
    });

    it('does not deliver the edit when the legacy edit fails', async () => {
      editLegacy.mockRejectedValue(new Error('edit refused'));
      const actions = mountActions({
        editingMessage: { message: target, previousDraft: '' },
      });

      await actions.editMessage('changed');

      expect(deliverEdit).not.toHaveBeenCalled();
      expect(actions.state.error).toBe('edit refused');
    });

    it('finishes the edit when inbox delivery throws synchronously', async () => {
      editLegacy.mockResolvedValue(editEvent);
      deliverEdit.mockImplementation(() => {
        throw new Error('inbox unavailable');
      });
      const actions = mountActions({
        editingMessage: { message: target, previousDraft: '' },
      });

      await actions.editMessage('changed');

      expect(actions.state.error).toBeNull();
      expect(actions.state.messages).toContainEqual(
        expect.objectContaining({
          content: 'changed',
          editMessageId: 'edit-1',
          id: 'message-1',
        }),
      );
      expect(actions.onEditingMessageChange).toHaveBeenCalledWith(null);
      expect(actions.updateActiveConversationDraft).toHaveBeenCalledWith('');
    });

    it('finishes the edit with no unhandled rejection when inbox delivery rejects', async () => {
      editLegacy.mockResolvedValue(editEvent);
      deliverEdit.mockRejectedValue(new Error('inbox unavailable'));
      const actions = mountActions({
        editingMessage: { message: target, previousDraft: '' },
      });

      const unhandled = await captureUnhandledRejections(() =>
        actions.editMessage('changed'),
      );

      expect(unhandled).toEqual([]);
      expect(actions.state.error).toBeNull();
      expect(actions.state.messages).toContainEqual(
        expect.objectContaining({
          content: 'changed',
          editMessageId: 'edit-1',
          id: 'message-1',
        }),
      );
      expect(actions.onEditingMessageChange).toHaveBeenCalledWith(null);
    });
  });

  describe('reaction', () => {
    it('delivers an added reaction to the active conversation after the legacy add resolves', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(createdAt);
      addReactionLegacy.mockResolvedValue(undefined);
      const actions = mountActions();

      await actions.toggleReaction(target, '👍', false);

      expect(addReactionLegacy).toHaveBeenCalledWith(
        session,
        conversation.id,
        'message-1',
        '👍',
      );
      expect(deliverReaction).toHaveBeenCalledWith(session, conversation, {
        action: 'add',
        createdAt,
        emoji: '👍',
        messageId: 'message-1',
      });
      expect(deliverReaction.mock.calls[0]?.[1]).toBe(conversation);
      expect(deliverReaction.mock.invocationCallOrder[0]).toBeGreaterThan(
        addReactionLegacy.mock.invocationCallOrder[0] ?? Infinity,
      );
    });

    it('delivers a removed reaction to the active conversation after the legacy remove resolves', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(createdAt);
      removeReactionLegacy.mockResolvedValue(undefined);
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

      expect(removeReactionLegacy).toHaveBeenCalledWith(
        session,
        conversation.id,
        'message-1',
        '👍',
      );
      expect(deliverReaction).toHaveBeenCalledWith(session, conversation, {
        action: 'remove',
        createdAt,
        emoji: '👍',
        messageId: 'message-1',
      });
      expect(deliverReaction.mock.calls[0]?.[1]).toBe(conversation);
    });

    it('does not deliver the reaction when the legacy call fails', async () => {
      addReactionLegacy.mockRejectedValue(new Error('reaction refused'));
      const actions = mountActions();

      await actions.toggleReaction(target, '👍', false);

      expect(deliverReaction).not.toHaveBeenCalled();
      expect(actions.state.error).toBe('reaction refused');
    });

    it('keeps the reaction applied when inbox delivery throws synchronously', async () => {
      addReactionLegacy.mockResolvedValue(undefined);
      deliverReaction.mockImplementation(() => {
        throw new Error('inbox unavailable');
      });
      const actions = mountActions();

      await actions.toggleReaction(target, '👍', false);

      expect(actions.state.error).toBeNull();
      expect(actions.state.messages[0]?.reactions).toEqual([
        expect.objectContaining({
          authorIdentityId: 'identity-1',
          emoji: '👍',
        }),
      ]);
    });

    it('keeps the reaction applied with no unhandled rejection when inbox delivery rejects', async () => {
      addReactionLegacy.mockResolvedValue(undefined);
      deliverReaction.mockRejectedValue(new Error('inbox unavailable'));
      const actions = mountActions();

      const unhandled = await captureUnhandledRejections(() =>
        actions.toggleReaction(target, '👍', false),
      );

      expect(unhandled).toEqual([]);
      expect(actions.state.error).toBeNull();
      expect(actions.state.messages[0]?.reactions).toEqual([
        expect.objectContaining({
          authorIdentityId: 'identity-1',
          emoji: '👍',
        }),
      ]);
    });
  });
});
