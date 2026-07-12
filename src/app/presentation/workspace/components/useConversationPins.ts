import { useState } from 'react';

import type {
  ChatMessage,
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import type { MessageCollectionState } from './conversationThreadState';

type UseConversationPinsInput = {
  activeConversation: ConversationResource | null;
  closeMessageContextMenu: () => void;
  onError: (error: string | null) => void;
  session: Session;
};

export function useConversationPins(input: UseConversationPinsInput) {
  const { activeConversation, closeMessageContextMenu, onError, session } =
    input;
  const [collection, setCollection] = useState<MessageCollectionState | null>(
    null,
  );
  const [pinnedMessageIds, setPinnedMessageIds] = useState<Set<string>>(
    () => new Set(),
  );

  const open = async () => {
    if (!activeConversation) return;

    setCollection({ error: null, messages: [], state: 'loading' });
    try {
      const pins = await applicationContainer.messages.listPins(
        session,
        activeConversation.id,
      );

      setPinnedMessageIds(new Set(pins.map((pin) => pin.messageId)));
      setCollection({
        error: null,
        messages: pins.map((pin) => pin.message),
        state: 'ready',
      });
    } catch (caught) {
      setCollection({
        error: toUserErrorMessage(caught, copy.messages.pinError),
        messages: [],
        state: 'ready',
      });
    }
  };

  const pin = async (message: ChatMessage) => {
    if (!activeConversation) return;

    closeMessageContextMenu();
    onError(null);
    try {
      await applicationContainer.messages.pin(
        session,
        activeConversation.id,
        message.id,
      );
      setPinnedMessageIds((current) => new Set(current).add(message.id));
    } catch (caught) {
      onError(toUserErrorMessage(caught, copy.messages.pinError));
    }
  };

  const unpinFromCollection = async (message: ChatMessage) => {
    if (!activeConversation) return;

    try {
      await applicationContainer.messages.unpin(
        session,
        activeConversation.id,
        message.id,
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

function withoutMessage(current: Set<string>, messageId: string): Set<string> {
  const next = new Set(current);

  next.delete(messageId);

  return next;
}
