import { useCallback, useEffect, useState } from 'react';

import type {
  ChatMessage,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';

type PinnedMessageCollection = {
  error: null | string;
  messages: ChatMessage[];
  state: 'loading' | 'ready';
};

type CommunityPinnedMessagesInput = {
  canManageMessages: boolean;
  closeMessageMenu: () => void;
  communityId: string;
  projectMessages: (
    channelId: string,
    messages: MessageResource[],
  ) => Promise<ChatMessage[]>;
  realtimeEvent?: null | RealtimeDomainEvent;
  selectedChannelId: null | string;
  session: Session;
};

export function useCommunityPinnedMessages({
  canManageMessages,
  closeMessageMenu,
  communityId,
  projectMessages,
  realtimeEvent,
  selectedChannelId,
  session,
}: CommunityPinnedMessagesInput) {
  const [collection, setCollection] =
    useState<PinnedMessageCollection | null>(null);
  const [messageIds, setMessageIds] = useState<Set<string>>(() => new Set());

  const close = useCallback(() => setCollection(null), []);

  const open = useCallback(async () => {
    if (!selectedChannelId) return;

    setCollection({ error: null, messages: [], state: 'loading' });
    try {
      const result = await applicationContainer.communities.listChannelMessagePins(
        session,
        communityId,
        selectedChannelId,
      );
      const pinnedMessages = await projectMessages(
        selectedChannelId,
        result.pins.map((pin) => pin.message),
      );

      setMessageIds(new Set(result.pins.map((pin) => pin.messageId)));
      setCollection({
        error: null,
        messages: pinnedMessages,
        state: 'ready',
      });
    } catch (caught) {
      setCollection({
        error: toUserErrorMessage(caught, copy.messages.pinError),
        messages: [],
        state: 'ready',
      });
    }
  }, [communityId, projectMessages, selectedChannelId, session]);

  useEffect(() => {
    if (!selectedChannelId) {
      setMessageIds(new Set());

      return;
    }

    let cancelled = false;

    void applicationContainer
      .communities.listChannelMessagePins(session, communityId, selectedChannelId)
      .then((result) => {
        if (!cancelled) {
          setMessageIds(new Set(result.pins.map((pin) => pin.messageId)));
        }
      })
      .catch(() => {
        if (!cancelled) setMessageIds(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [communityId, selectedChannelId, session]);

  useEffect(() => {
    if (!realtimeEvent || realtimeEvent.aggregate_id !== communityId) return;

    if (
      realtimeEvent.type !== 'communities.v1.channel.message.was_pinned' &&
      realtimeEvent.type !== 'communities.v1.channel.message.was_unpinned'
    ) {
      return;
    }

    const channelId =
      typeof realtimeEvent.attributes.channelId === 'string'
        ? realtimeEvent.attributes.channelId
        : null;
    const messageId =
      typeof realtimeEvent.attributes.messageId === 'string'
        ? realtimeEvent.attributes.messageId
        : null;

    if (!messageId || channelId !== selectedChannelId) return;

    setMessageIds((current) => {
      const next = new Set(current);

      if (realtimeEvent.type.endsWith('.was_pinned')) {
        next.add(messageId);
      } else {
        next.delete(messageId);
      }

      return next;
    });
  }, [communityId, realtimeEvent, selectedChannelId]);

  const pin = useCallback(
    async (message: ChatMessage) => {
      const channelId = message.raw.channelId ?? selectedChannelId;

      if (!channelId || !canManageMessages) return;

      closeMessageMenu();
      try {
        await applicationContainer.communities.pinChannelMessage(
          session,
          communityId,
          channelId,
          message.id,
        );
        setMessageIds((current) => new Set(current).add(message.id));
      } catch (caught) {
        setCollection({
          error: toUserErrorMessage(caught, copy.messages.pinError),
          messages: [],
          state: 'ready',
        });
      }
    },
    [
      canManageMessages,
      closeMessageMenu,
      communityId,
      selectedChannelId,
      session,
    ],
  );

  const unpinFromCollection = useCallback(
    async (message: ChatMessage) => {
      const channelId = message.raw.channelId ?? selectedChannelId;

      if (!channelId || !canManageMessages) return;

      try {
        await applicationContainer.communities.unpinChannelMessage(
          session,
          communityId,
          channelId,
          message.id,
        );
        setMessageIds((current) => {
          const next = new Set(current);

          next.delete(message.id);

          return next;
        });
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
    },
    [canManageMessages, communityId, selectedChannelId, session],
  );

  const unpin = useCallback(
    async (message: ChatMessage) => {
      closeMessageMenu();
      await unpinFromCollection(message);
    },
    [closeMessageMenu, unpinFromCollection],
  );

  return {
    close,
    collection,
    messageIds,
    open,
    pin,
    unpin,
    unpinFromCollection,
  };
}
