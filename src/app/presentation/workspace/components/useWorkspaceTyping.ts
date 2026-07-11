import { useCallback, useEffect, useRef, useState } from 'react';

import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type {
  RealtimeTypingInput,
  RealtimeTypingMessage,
} from '../../../../shared/infrastructure/realtime/RealtimeGateway';

import { sendRealtimeTyping } from '../../realtime/useRealtimeEvents';
import {
  activeTypingIdentityIds,
  communityTypingKey,
  expireTypingEntries,
  type TypingEntries,
  typingInputKey,
  updateTypingEntries,
} from '../typingEntries';

type WorkspaceTypingInput = {
  activeCommunityChannelId: null | string;
  activeCommunityId: null | string;
  activeConversationId: null | string;
  session: Session;
};

export function useWorkspaceTyping({
  activeCommunityChannelId,
  activeCommunityId,
  activeConversationId,
  session,
}: WorkspaceTypingInput) {
  const [conversationEntries, setConversationEntries] =
    useState<TypingEntries>({});
  const [communityEntries, setCommunityEntries] = useState<TypingEntries>({});
  const sentRef = useRef(
    new Map<string, { active: boolean; sentAt: number }>(),
  );

  const receive = useCallback(
    (message: RealtimeTypingMessage) => {
      if (message.identityId === session.identity.id) return;

      const expiresAt = Date.now() + 5000;

      if (message.scope === 'conversation') {
        setConversationEntries((current) =>
          updateTypingEntries(
            current,
            message.conversationId,
            message.identityId,
            message.active ? expiresAt : null,
          ),
        );

        return;
      }

      setCommunityEntries((current) =>
        updateTypingEntries(
          current,
          communityTypingKey(message.communityId, message.channelId),
          message.identityId,
          message.active ? expiresAt : null,
        ),
      );
    },
    [session.identity.id],
  );

  const send = useCallback(
    (input: RealtimeTypingInput) => {
      const key = typingInputKey(input);
      const current = sentRef.current.get(key);
      const now = Date.now();

      if (input.active && current?.active && now - current.sentAt < 2500) {
        return;
      }

      if (!input.active && current && !current.active) return;

      sentRef.current.set(key, { active: input.active, sentAt: now });
      sendRealtimeTyping(session, input);
    },
    [session],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setConversationEntries(expireTypingEntries);
      setCommunityEntries(expireTypingEntries);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const sendConversationTyping = useCallback(
    (active: boolean) => {
      if (!activeConversationId) return;

      send({
        active,
        conversationId: activeConversationId,
        scope: 'conversation',
      });
    },
    [activeConversationId, send],
  );

  const sendCommunityTyping = useCallback(
    (channelId: string, active: boolean) => {
      if (!activeCommunityId) return;

      send({
        active,
        channelId,
        communityId: activeCommunityId,
        scope: 'community_channel',
      });
    },
    [activeCommunityId, send],
  );

  return {
    communityTypingIdentityIds: activeTypingIdentityIds(
      communityEntries,
      activeCommunityId && activeCommunityChannelId
        ? communityTypingKey(activeCommunityId, activeCommunityChannelId)
        : null,
    ),
    conversationTypingIdentityIds: activeTypingIdentityIds(
      conversationEntries,
      activeConversationId,
    ),
    receive,
    sendCommunityTyping,
    sendConversationTyping,
  };
}
