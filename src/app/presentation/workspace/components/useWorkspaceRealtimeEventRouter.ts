import {
  useCallback,
  useMemo,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';

import type { NotificationSettingMap } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingMap';
import type {
  ChatMessage,
  Community,
  ConversationResource,
  IdentityPresence,
  MessageResource,
  PollResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';

import { CommunityAccessPolicy } from '../../../../contexts/communities/presentation/view-models/CommunityAccessPolicy';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { showPwaNotification } from '../../../../contexts/notifications/presentation/services/pwaNotifications';
import { communityNotificationPreview } from '../../../../contexts/notifications/presentation/view-models/notificationPreviews';
import { NotificationSettingsPolicy } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingsPolicy';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { applicationContainer } from '../../../composition/applicationContainer';
import { presenceFromRealtimeEvent } from '../presenceFromRealtimeEvent';
import { isBrowserPageVisible } from './isBrowserPageVisible';
import {
  eventAggregateId,
  recordAttribute,
  stringAttribute,
} from './realtimeEventAttributes';
import { notificationMentionContext } from './workspaceNotificationState';
import { WorkspaceRealtimeEvent } from './WorkspaceRealtimeEvent';

type WorkspaceRealtimeEventRouterInput = {
  activeCommunityChannelId: null | string;
  activeCommunityId: null | string;
  activeCommunityNetworkId: null | string;
  activeConversationNetworkId: null | string;
  communities: Community[];
  handleCallEvent: (event: RealtimeDomainEvent) => void;
  handleCommunityDomainEvent: (event: RealtimeDomainEvent) => boolean;
  handleConversationEvent: (event: RealtimeDomainEvent) => boolean;
  identityNames: Record<string, string>;
  markCommunityChannelUnread: (communityId: string, channelId: string) => void;
  mergePresence: (presence: IdentityPresence) => void;
  notificationSettingsRef: RefObject<NotificationSettingMap>;
  onNotificationSound: () => void;
  onNodeNetworksReload: () => Promise<void>;
  onPeersReload: () => Promise<void>;
  refreshNotifications: () => Promise<unknown>;
  refreshSession: () => Promise<unknown>;
  rememberIdentity: (identity: Session['identity']) => void;
  realtimeEventsOpen: boolean;
  session: Session;
  setActiveCommunityId: (communityId: null | string) => void;
  setActiveConversationId: (conversationId: null | string) => void;
  setCommunities: Dispatch<SetStateAction<Community[]>>;
  setCommunityRealtimeEvent: (event: RealtimeDomainEvent) => void;
  setConversationRealtimeEvent: (event: RealtimeDomainEvent) => void;
  setConversations: Dispatch<SetStateAction<ConversationResource[]>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setRealtimeEventLog: Dispatch<SetStateAction<RealtimeDomainEvent[]>>;
  setSession: (session: Session) => void;
  updateMessageCursor: (cursor: null | string) => void;
  workspaceMode: 'community' | 'messages';
};

const isActiveCommunityChannel = (
  workspaceMode: 'community' | 'messages',
  activeCommunityId: null | string,
  activeCommunityChannelId: null | string,
  communityId: string,
  channelId: string,
): boolean =>
  isBrowserPageVisible() &&
  workspaceMode === 'community' &&
  communityId === activeCommunityId &&
  channelId === activeCommunityChannelId;

const shouldSuppressCommunityNotification = (
  active: boolean,
  allowed: boolean,
  authorIdentityId: string | undefined,
  currentIdentityId: string,
): boolean => active || !allowed || authorIdentityId === currentIdentityId;

export function useWorkspaceRealtimeEventRouter({
  activeCommunityChannelId,
  activeCommunityId,
  activeCommunityNetworkId,
  activeConversationNetworkId,
  communities,
  handleCallEvent,
  handleCommunityDomainEvent,
  handleConversationEvent,
  identityNames,
  markCommunityChannelUnread,
  mergePresence,
  notificationSettingsRef,
  onNodeNetworksReload,
  onNotificationSound,
  onPeersReload,
  realtimeEventsOpen,
  refreshNotifications,
  refreshSession,
  rememberIdentity,
  session,
  setActiveCommunityId,
  setActiveConversationId,
  setCommunities,
  setCommunityRealtimeEvent,
  setConversationRealtimeEvent,
  setConversations,
  setMessages,
  setRealtimeEventLog,
  setSession,
  updateMessageCursor,
  workspaceMode,
}: WorkspaceRealtimeEventRouterInput): (event: RealtimeDomainEvent) => void {
  const handleIdentityEvent = useCallback(
    (event: RealtimeDomainEvent) => {
      if (event.type === 'identities.v1.identity.was_updated') {
        const identityId =
          eventAggregateId(event) ?? stringAttribute(event, 'identityId', 'id');

        if (identityId) {
          void applicationContainer.identities
            .refresh(IdentityId.normalize(identityId))
            .then(rememberIdentity)
            .catch(() => undefined);
        }

        return;
      }

      if (event.aggregate_id !== session.identity.id) return;

      void applicationContainer.identities
        .get(session.identity.id)
        .then((identity) => setSession({ ...session, identity }))
        .catch(() => undefined);
    },
    [rememberIdentity, session, setSession],
  );

  const handleNodeEvent = useCallback(
    (event: RealtimeDomainEvent) => {
      if (event.type === 'nodes.v1.node.network.was_removed') {
        const removedNetworkId = stringAttribute(event, 'networkId');

        if (removedNetworkId) {
          setConversations((current) =>
            current.filter(
              (conversation) => conversation.networkId !== removedNetworkId,
            ),
          );
          setCommunities((current) =>
            current.filter(
              (community) => community.networkId !== removedNetworkId,
            ),
          );

          if (activeConversationNetworkId === removedNetworkId) {
            setActiveConversationId(null);
            setMessages([]);
            updateMessageCursor(null);
          }

          if (activeCommunityNetworkId === removedNetworkId) {
            setActiveCommunityId(null);
          }
        }

        void onNodeNetworksReload().catch(() => undefined);
      }

      void onPeersReload().catch(() => undefined);
    },
    [
      activeCommunityNetworkId,
      activeConversationNetworkId,
      onNodeNetworksReload,
      onPeersReload,
      setActiveCommunityId,
      setActiveConversationId,
      setCommunities,
      setConversations,
      setMessages,
      updateMessageCursor,
    ],
  );

  const handleNotificationEvent = useCallback(
    (event: RealtimeDomainEvent) => {
      onNotificationSound();
      void showPwaNotification({
        body: copy.notifications.open,
        tag: `notification-${event.event_id}`,
        title: copy.notifications.title,
      });
      void refreshNotifications();
    },
    [onNotificationSound, refreshNotifications],
  );

  const handlePollEvent = useCallback(
    (event: RealtimeDomainEvent) => {
      const poll = recordAttribute(event, 'poll') as PollResource | undefined;
      const participantIds = event.attributes.participantIds;
      const memberIds = event.attributes.memberIds;

      if (
        poll?.scope.type === 'group_conversation' ||
        Array.isArray(participantIds)
      ) {
        setConversationRealtimeEvent(event);

        return;
      }

      if (
        poll?.scope.type === 'community_channel' ||
        Array.isArray(memberIds)
      ) {
        setCommunityRealtimeEvent(event);
      }
    },
    [setCommunityRealtimeEvent, setConversationRealtimeEvent],
  );

  const notifyCommunityMessage = useCallback(
    (event: RealtimeDomainEvent) => {
      const communityId =
        eventAggregateId(event) ?? stringAttribute(event, 'communityId');
      const channelId = stringAttribute(event, 'channelId');
      const authorIdentityId = stringAttribute(event, 'authorIdentityId');

      if (!communityId || !channelId) return;

      const timelineMessage = recordAttribute(event, 'message') as
        | MessageResource
        | undefined;
      const eventCommunity = communities.find(
        (community) => community.id === communityId,
      );

      if (!eventCommunity) return;

      const setting = NotificationSettingsPolicy.resolve(
        notificationSettingsRef.current,
        { channelId, communityId, type: 'community_channel' },
      );
      const notificationAllowed = NotificationSettingsPolicy.shouldNotify(
        setting,
        notificationMentionContext({
          currentIdentityId: session.identity.id,
          currentRoleIds: [
            ...CommunityAccessPolicy.assignedRoleIdsFor(
              eventCommunity,
              session.identity.id,
            ),
          ],
          event,
        }),
      );
      const active = isActiveCommunityChannel(
        workspaceMode,
        activeCommunityId,
        activeCommunityChannelId,
        communityId,
        channelId,
      );

      if (
        shouldSuppressCommunityNotification(
          active,
          notificationAllowed,
          authorIdentityId,
          session.identity.id,
        )
      ) {
        return;
      }

      const preview = communityNotificationPreview(
        communities,
        communityId,
        channelId,
        authorIdentityId,
        identityNames,
        timelineMessage,
      );

      onNotificationSound();
      void showPwaNotification({
        body: preview.body,
        tag: `community-${communityId}-${channelId}`,
        title: preview.title,
      });
      markCommunityChannelUnread(communityId, channelId);
    },
    [
      activeCommunityChannelId,
      activeCommunityId,
      communities,
      identityNames,
      markCommunityChannelUnread,
      notificationSettingsRef,
      onNotificationSound,
      session.identity.id,
      workspaceMode,
    ],
  );

  const handleCommunityMessage = useCallback(
    (event: RealtimeDomainEvent) => {
      notifyCommunityMessage(event);
      setCommunityRealtimeEvent(event);
    },
    [notifyCommunityMessage, setCommunityRealtimeEvent],
  );

  const handleCommunityEvent = useCallback(
    (event: RealtimeDomainEvent) => {
      if (handleCommunityDomainEvent(event)) return;

      if (event.type === 'communities.v1.channel.message.was_sent') {
        handleCommunityMessage(event);

        return;
      }

      if (WorkspaceRealtimeEvent.updatesCommunityTimeline(event)) {
        setCommunityRealtimeEvent(event);
      }
    },
    [
      handleCommunityDomainEvent,
      handleCommunityMessage,
      setCommunityRealtimeEvent,
    ],
  );

  const handlers = useMemo(
    () => ({
      call: handleCallEvent,
      community: handleCommunityEvent,
      conversation: handleConversationEvent,
      identity: handleIdentityEvent,
      ignored: () => undefined,
      keychain: () => void refreshSession().catch(() => undefined),
      node: handleNodeEvent,
      notification: handleNotificationEvent,
      poll: handlePollEvent,
    }),
    [
      handleCallEvent,
      handleCommunityEvent,
      handleConversationEvent,
      handleIdentityEvent,
      handleNodeEvent,
      handleNotificationEvent,
      handlePollEvent,
      refreshSession,
    ],
  );

  return useCallback(
    (event: RealtimeDomainEvent) => {
      // eslint-disable-next-line no-console
      console.debug('[pigeon realtime] domain_event', event.type, event);

      if (realtimeEventsOpen) {
        setRealtimeEventLog((current) => {
          if (current.some((item) => item.event_id === event.event_id)) {
            return current;
          }

          return [...current.slice(-99), event];
        });
      }

      const presence = presenceFromRealtimeEvent(event);

      if (presence) {
        mergePresence(presence);

        return;
      }

      handlers[WorkspaceRealtimeEvent.category(event)](event);
    },
    [handlers, mergePresence, realtimeEventsOpen, setRealtimeEventLog],
  );
}
