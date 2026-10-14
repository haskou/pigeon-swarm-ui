import { useEffect, useState } from 'react';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';
import type { MessageCollectionState } from './conversationThreadState';
import type { UseConversationPinsResult } from './UseConversationPinsResult';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { ConversationMessageCommands } from './ConversationMessageCommands';

type UseConversationPinsInput = {
  activeConversation?: ConversationResource;
  closeMessageContextMenu: () => void;
  messages: ChatMessage[];
  onError: (error: string | null) => void;
  session: Session;
};

function withoutMessage(current: Set<string>, messageId: string): Set<string> {
  const next = new Set(current);

  next.delete(messageId);

  return next;
}

export function useConversationPins(
  input: UseConversationPinsInput,
): UseConversationPinsResult {
  const {
    activeConversation,
    closeMessageContextMenu,
    messages,
    onError,
    session,
  } = input;
  const activeConversationId = activeConversation?.id;
  const [collection, setCollection] = useState<MessageCollectionState | null>(
    null,
  );
  const [pinnedMessageIds, setPinnedMessageIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (!activeConversationId) setPinnedMessageIds(new Set());
  }, [activeConversationId]);

  // Pins come from mailbox pin changes; no mailbox lists pins, so the pins
  // view is the pinned messages already present in the local timeline.
  const open = () => {
    if (!activeConversationId) return;

    setCollection({
      error: null,
      messages: messages.filter((message) => pinnedMessageIds.has(message.id)),
      state: 'ready',
    });
  };

  const pin = async (message: ChatMessage) => {
    if (!activeConversation) return;

    closeMessageContextMenu();
    onError(null);
    try {
      await ConversationMessageCommands.pin(
        session,
        activeConversation,
        message.id,
        'pin',
      );
      setPinnedMessageIds((current) => new Set(current).add(message.id));
    } catch (caught) {
      onError(toUserErrorMessage(caught, copy.messages.pinError));
    }
  };

  const unpinFromCollection = async (message: ChatMessage) => {
    if (!activeConversation) return;

    try {
      await ConversationMessageCommands.pin(
        session,
        activeConversation,
        message.id,
        'unpin',
      );
      setPinnedMessageIds((current) => withoutMessage(current, message.id));
      setCollection((current) =>
        current
          ? {
              ...current,
              messages: current.messages.filter(
                (item) => item.id !== message.id,
              ),
            }
          : current,
      );
    } catch (caught) {
      setCollection((current) =>
        current
          ? {
              ...current,
              error: toUserErrorMessage(caught, copy.messages.unpinError),
            }
          : current,
      );
    }
  };

  const unpin = async (message: ChatMessage) => {
    closeMessageContextMenu();
    await unpinFromCollection(message);
  };

  return {
    close: () => setCollection(null),
    collection,
    open,
    pin,
    pinnedMessageIds,
    setCollection,
    setPinnedMessageIds,
    unpin,
    unpinFromCollection,
  };
}
