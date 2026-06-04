import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
} from 'react';

import type {
  ChatMessage,
  MessageResource,
  PollResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/realtimeGateway';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { MessageReactions } from '../../../messages/domain/MessageReactions';
import {
  mergeChatMessages,
  realtimeMessageAttribute,
  realtimeStringAttribute,
} from './communityWorkspaceHelpers';
import type { LoadCommunityChannelMessages } from './useCommunityChannelMessages';

type ProjectCommunityChannelMessage = (
  channelId: string,
  message: MessageResource,
) => Promise<ChatMessage>;

type UseCommunityChannelRealtimeInput = {
  communityId: string;
  incrementNewChannelMessageCount: () => void;
  isScrolledNearBottom: () => boolean;
  loadChannelMessages: LoadCommunityChannelMessages;
  onChannelViewed?: (channelId: string) => void;
  onMessageDeleted?: (messageId: string) => void;
  onMessageEdited?: (message: ChatMessage) => void;
  onThreadMessageReceived?: (message: ChatMessage) => void;
  projectChannelMessage: ProjectCommunityChannelMessage;
  realtimeEvent?: null | RealtimeDomainEvent;
  resetNewChannelMessageCount: () => void;
  scrollChannelToBottom: (behavior?: ScrollBehavior, keepPinned?: boolean) => void;
  selectedChannelId: null | string;
  session: Session;
  shouldCountNewChannelMessage: (channelId: string) => boolean;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  upsertPoll: (poll: PollResource) => void;
};

function isBrowserPageVisible(): boolean {
  return (
    typeof document === 'undefined' || document.visibilityState !== 'hidden'
  );
}

export function useCommunityChannelRealtime({
  communityId,
  incrementNewChannelMessageCount,
  isScrolledNearBottom,
  loadChannelMessages,
  onChannelViewed,
  onMessageDeleted,
  onMessageEdited,
  onThreadMessageReceived,
  projectChannelMessage,
  realtimeEvent,
  resetNewChannelMessageCount,
  scrollChannelToBottom,
  selectedChannelId,
  session,
  shouldCountNewChannelMessage,
  setMessages,
  upsertPoll,
}: UseCommunityChannelRealtimeInput) {
  const loadChannelMessagesRef = useRef(loadChannelMessages);

  useEffect(() => {
    loadChannelMessagesRef.current = loadChannelMessages;
  }, [loadChannelMessages]);

  useEffect(() => {
    if (!realtimeEvent || realtimeEvent.aggregate_id !== communityId) return;

    if (realtimeEvent.type.startsWith('polls.v1.')) {
      const poll = realtimeEvent.attributes.poll as PollResource | undefined;
      const pollId = realtimeStringAttribute(realtimeEvent, 'pollId');

      if (poll) {
        upsertPoll(poll);

        return;
      }

      if (pollId) {
        void applicationContainer
          .getPoll(session, pollId)
          .then(upsertPoll)
          .catch(() => undefined);
      }

      return;
    }

    const channelId = realtimeStringAttribute(realtimeEvent, 'channelId');

    if (!channelId || channelId !== selectedChannelId) return;

    if (realtimeEvent.type === 'communities.v1.channel.message.was_deleted') {
      const targetMessageId = realtimeStringAttribute(
        realtimeEvent,
        'targetMessageId',
      );

      if (!targetMessageId) return;

      setMessages((current) =>
        current.filter((message) => message.id !== targetMessageId),
      );
      onMessageDeleted?.(targetMessageId);

      return;
    }

    if (
      realtimeEvent.type ===
        'communities.v1.channel.message.reaction.was_added' ||
      realtimeEvent.type ===
        'communities.v1.channel.message.reaction.was_removed'
    ) {
      const messageId = realtimeStringAttribute(realtimeEvent, 'messageId');
      const authorIdentityId = realtimeStringAttribute(
        realtimeEvent,
        'authorId',
        'authorIdentityId',
      );
      const emoji = realtimeStringAttribute(realtimeEvent, 'emoji');

      if (!messageId || !authorIdentityId || !emoji) return;

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? MessageReactions.update(
                message,
                authorIdentityId,
                emoji,
                realtimeEvent.type.endsWith('.was_added') ? 'add' : 'remove',
                typeof realtimeEvent.attributes.createdAt === 'number'
                  ? realtimeEvent.attributes.createdAt
                  : realtimeEvent.occurred_on,
              )
            : message,
        ),
      );

      return;
    }

    if (realtimeEvent.type === 'communities.v1.channel.message.was_edited') {
      const message = realtimeMessageAttribute(realtimeEvent);

      if (message) {
        void projectChannelMessage(channelId, message)
          .then((projected) => {
            onMessageEdited?.(projected);
            setMessages((current) =>
              current.some((item) => item.id === projected.id)
                ? mergeChatMessages(current, [projected])
                : current,
            );
          })
          .catch(() => undefined);

        return;
      }

      let cancelled = false;

      void loadChannelMessagesRef
        .current(channelId)
        .then(({ loadedMessages }) => {
          if (cancelled) return;

          setMessages((current) => mergeChatMessages(current, loadedMessages));
          loadedMessages.forEach((message) => onMessageEdited?.(message));
        })
        .catch(() => undefined);

      return () => {
        cancelled = true;
      };
    }

    if (
      realtimeEvent.type !== 'communities.v1.channel.message.was_sent' &&
      realtimeEvent.type !== 'communities.v1.call.event.was_recorded'
    ) {
      return;
    }

    const message = realtimeMessageAttribute(realtimeEvent);

    if (!message) {
      const shouldStickToBottom = isScrolledNearBottom();
      const shouldMarkViewed = shouldStickToBottom && isBrowserPageVisible();
      let cancelled = false;

      void loadChannelMessagesRef
        .current(channelId)
        .then(({ loadedMessages }) => {
          if (cancelled) return;

          setMessages((current) => mergeChatMessages(current, loadedMessages));

          if (shouldMarkViewed) {
            resetNewChannelMessageCount();
            onChannelViewed?.(channelId);
            scrollChannelToBottom('smooth', true);
          } else if (shouldCountNewChannelMessage(channelId)) {
            incrementNewChannelMessageCount();
          }
        })
        .catch(() => undefined);

      return () => {
        cancelled = true;
      };
    }

    const shouldStickToBottom = isScrolledNearBottom();
    const shouldMarkViewed = shouldStickToBottom && isBrowserPageVisible();
    let cancelled = false;

    void projectChannelMessage(channelId, message)
      .then((projected) => {
        if (cancelled) return;

        if (projected.threadRootMessageId) {
          onThreadMessageReceived?.(projected);

          return;
        }

        setMessages((current) => {
          if (current.some((item) => item.id === projected.id)) return current;

          return [...current, projected].sort(
            (left, right) => left.timestamp - right.timestamp,
          );
        });

        if (shouldMarkViewed) {
          resetNewChannelMessageCount();
          onChannelViewed?.(channelId);
          scrollChannelToBottom('smooth', true);
        } else if (shouldCountNewChannelMessage(channelId)) {
          incrementNewChannelMessageCount();
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    communityId,
    incrementNewChannelMessageCount,
    isScrolledNearBottom,
    onChannelViewed,
    onMessageDeleted,
    onMessageEdited,
    onThreadMessageReceived,
    projectChannelMessage,
    realtimeEvent,
    resetNewChannelMessageCount,
    scrollChannelToBottom,
    selectedChannelId,
    session,
    setMessages,
    upsertPoll,
  ]);
}
