import { useEffect, useState } from 'react';

import type {
  ChatMessage,
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { MessageCollectionState } from './conversationThreadState';
import type { UseConversationPinsResult } from './UseConversationPinsResult';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { runWhenBrowserIdle } from '../../../../shared/presentation/runWhenBrowserIdle';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';

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
    if (!activeConversationId) {
      setPinnedMessageIds(new Set());

      return;
    }

    // One-to-one pins are not replicated: they come from mailbox pin changes.
    if (activeConversation?.type === 'one-to-one') return;

    let cancelled = false;
    const loadPins = async () => {
      try {
        const pins = await applicationContainer.messages.listPins(
          session,
          activeConversationId,
        );

        if (!cancelled) {
          setPinnedMessageIds(new Set(pins.map((pin) => pin.messageId)));
        }
      } catch {
        if (!cancelled) setPinnedMessageIds(new Set());
      }
    };
    const cancelIdleWork = runWhenBrowserIdle(loadPins);

    return () => {
      cancelled = true;
      cancelIdleWork();
    };
  }, [activeConversation?.type, activeConversationId, session]);

  const open = async () => {
    if (!activeConversationId) return;

    if (activeConversation?.type === 'one-to-one') {
      // The mailbox has no pin listing; the pins view is the pinned messages
      // already present in the local timeline.
      setCollection({
        error: null,
        messages: messages.filter((message) =>
          pinnedMessageIds.has(message.id),
        ),
        state: 'ready',
      });

      return;
    }

    setCollection({ error: null, messages: [], state: 'loading' });
    try {
      const pins = await applicationContainer.messages.listPins(
        session,
        activeConversationId,
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
    const createdAt = Date.now();
    try {
      if (activeConversation.type === 'one-to-one') {
        await applicationContainer.directMessages.pin(
          session,
          activeConversation,
          { action: 'pin', createdAt, messageId: message.id },
        );
      } else {
        await applicationContainer.messages.pin(
          session,
          activeConversation.id,
          message.id,
        );
      }
      setPinnedMessageIds((current) => new Set(current).add(message.id));
    } catch (caught) {
      onError(toUserErrorMessage(caught, copy.messages.pinError));
    }
  };

  const unpinFromCollection = async (message: ChatMessage) => {
    if (!activeConversation) return;

    const createdAt = Date.now();
    try {
      if (activeConversation.type === 'one-to-one') {
        await applicationContainer.directMessages.pin(
          session,
          activeConversation,
          { action: 'unpin', createdAt, messageId: message.id },
        );
      } else {
        await applicationContainer.messages.unpin(
          session,
          activeConversation.id,
          message.id,
        );
      }
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
