import { useCallback, useEffect, useRef, useState } from 'react';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { DirectMessageTimelineChange } from '../../../../contexts/messages/domain/DirectMessageTimelineChange';
import type {
  RealtimeTypingInput,
  RealtimeTypingMessage,
} from '../../../../shared/infrastructure/realtime/RealtimeGateway';

import { ConversationType } from '../../../../contexts/conversations/domain/value-objects/ConversationType';
import { IdentityMatch } from '../../../../contexts/identities/domain/IdentityMatch';
import { GroupMailboxEligibility } from '../../../../contexts/mailboxes/domain/GroupMailboxEligibility';
import { applicationContainer } from '../../../composition/applicationContainer';
import { sendRealtimeTyping } from '../../realtime/useRealtimeEvents';
import {
  activeTypingIdentityIds,
  applyGroupTypingChanges,
  communityTypingKey,
  expireTypingEntries,
  type TypingEntries,
  typingInputKey,
  updateTypingEntries,
} from '../typingEntries';

type WorkspaceTypingInput = {
  activeCommunityChannelId: null | string;
  activeCommunityId: null | string;
  activeConversation: ConversationResource | undefined;
  session: Session;
};

/**
 * Typing indicators of the open conversation and community channel. A
 * group conversation's typing travels as an ephemeral MLS record through
 * its mailboxes (`receiveGroupTyping`), never through the node; direct
 * conversations and community channels use the realtime relay.
 */
export function useWorkspaceTyping({
  activeCommunityChannelId,
  activeCommunityId,
  activeConversation,
  session,
}: WorkspaceTypingInput): {
  communityTypingIdentityIds: string[];
  conversationTypingIdentityIds: string[];
  receive: (message: RealtimeTypingMessage) => void;
  receiveGroupTyping: (
    conversationId: string,
    changes: DirectMessageTimelineChange[],
  ) => void;
  sendCommunityTyping: (channelId: string, active: boolean) => void;
  sendConversationTyping: (active: boolean) => void;
} {
  const activeConversationId = activeConversation?.id ?? null;
  const groupConversation =
    activeConversation !== undefined &&
    GroupMailboxEligibility.isEligible(
      ConversationType.tryFromPrimitives(activeConversation.type),
    );
  const [conversationEntries, setConversationEntries] = useState<TypingEntries>(
    {},
  );
  const [communityEntries, setCommunityEntries] = useState<TypingEntries>({});
  const sentRef = useRef(
    new Map<string, { active: boolean; sentAt: number }>(),
  );

  const receive = useCallback(
    (message: RealtimeTypingMessage) => {
      if (IdentityMatch.isSame(message.identityId, session.identity.id)) return;

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

  const receiveGroupTyping = useCallback(
    (conversationId: string, changes: DirectMessageTimelineChange[]) => {
      setConversationEntries((current) =>
        applyGroupTypingChanges(current, conversationId, changes, Date.now()),
      );
    },
    [],
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

      if (groupConversation) {
        if (!active) return;
        void applicationContainer.groupMessages
          .typing(session, activeConversationId)
          .catch(() => undefined);

        return;
      }

      send({
        active,
        conversationId: activeConversationId,
        scope: 'conversation',
      });
    },
    [activeConversationId, groupConversation, send, session],
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
    receiveGroupTyping,
    sendCommunityTyping,
    sendConversationTyping,
  };
}
