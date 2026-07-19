import { useEffect, useState } from 'react';

import type {
  ChatMessage,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { MessageCollectionState } from './conversationThreadState';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { runWhenBrowserIdle } from '../../../../shared/presentation/runWhenBrowserIdle';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';

type UseConversationPinsInput = {
  activeConversationId?: string;
  closeMessageContextMenu: () => void;
  onError: (error: string | null) => void;
  session: Session;
};

type UseConversationPinsResult = {
  close: () => void;
  collection: MessageCollectionState | null;
  open: () => Promise<void>;
  pin: (message: ChatMessage) => Promise<void>;
  pinnedMessageIds: Set<string>;
  setCollection: React.Dispatch<
    React.SetStateAction<MessageCollectionState | null>
  >;
  setPinnedMessageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  unpin: (message: ChatMessage) => Promise<void>;
  unpinFromCollection: (message: ChatMessage) => Promise<void>;
};

function withoutMessage(current: Set<string>, messageId: string): Set<string> {
  const next = new Set(current);

  next.delete(messageId);

  return next;
}

export function useConversationPins(
  input: UseConversationPinsInput,
): UseConversationPinsResult {
  const { activeConversationId, closeMessageContextMenu, onError, session } =
    input;
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

    let cancelled = false;
    const cancelIdleWork = runWhenBrowserIdle(async () => {
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
    });

    return () => {
      cancelled = true;
      cancelIdleWork();
    };
  }, [activeConversationId, session]);

  const open = async () => {
    if (!activeConversationId) return;

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
    if (!activeConversationId) return;

    closeMessageContextMenu();
    onError(null);
    try {
      await applicationContainer.messages.pin(
        session,
        activeConversationId,
        message.id,
      );
      setPinnedMessageIds((current) => new Set(current).add(message.id));
    } catch (caught) {
      onError(toUserErrorMessage(caught, copy.messages.pinError));
    }
  };

  const unpinFromCollection = async (message: ChatMessage) => {
    if (!activeConversationId) return;

    try {
      await applicationContainer.messages.unpin(
        session,
        activeConversationId,
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
