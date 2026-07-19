import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';

import type { CallSession } from '../../../../contexts/calls/presentation/view-models/CallSession';
import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';
import type {
  Community,
  ConversationResource,
  IdentityPresence,
  IdentityResource,
  NotificationScopeSetting,
  SelectablePresenceStatus,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { SidebarConversationMenuState } from './SidebarConversationMenuState';

import {
  type IdentityNames,
  type IdentityPictures,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import { ClearableSearchInput } from '../../../../shared/presentation/components/ClearableSearchInput';
import { SectionTitle } from '../../../../shared/presentation/components/SectionTitle';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { SidebarConversation } from './SidebarConversation';
import { SidebarConversationListItem } from './SidebarConversationListItem';
import { useIdentityBannerUrls } from './useIdentityBannerUrls';
import { UserProfileDropdown } from './UserProfileDropdown';

interface SidebarProps {
  animateEntries?: boolean;
  animationScopeKey?: string;
  session: Session;
  communities: Community[];
  conversations: ConversationResource[];
  nodeNetworks: NodeNetwork[];
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  identityProfiles: Record<string, IdentityResource>;
  presenceByIdentityId?: Record<string, IdentityPresence>;
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  conversationNotificationSetting?: (
    conversation: ConversationResource,
  ) => NotificationScopeSetting;
  onCreate: () => void;
  onLogout: () => void;
  onSessionUpdated: (session: Session) => void;
  onConversationNotificationMuteToggle?: (
    conversation: ConversationResource,
  ) => void;
  onConversationNotificationSettingsOpen?: (
    conversation: ConversationResource,
    title: string,
  ) => void;
  onPresenceChange?: (presence: IdentityPresence) => void;
  onPresenceStatusSelected?: (status: SelectablePresenceStatus) => void;
  activeCall?: CallSession | null;
  onCallEnd?: () => void;
  onCallParticipantVolumeChange?: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onCallParticipantScreenShareVolumeChange?: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onCallScreenShareQualityChange?: (
    quality: CallSession['screenShareQuality'],
  ) => void;
  onCallToggleCamera?: () => void;
  onCallToggleDeafen?: () => void;
  onCallToggleMute?: () => void;
  onCallToggleMediaEncryption?: () => void;
  onCallToggleNoiseCancellation?: () => void;
  onCallRetryMicrophone?: () => void;
  onCallToggleScreenShare?: () => void;
}

export function Sidebar({
  activeCall,
  activeConversationId,
  animateEntries = true,
  animationScopeKey,
  communities,
  conversationNotificationSetting,
  conversations,
  identityNames,
  identityPictures,
  identityProfiles,
  nodeNetworks,
  onCallEnd,
  onCallParticipantScreenShareVolumeChange,
  onCallParticipantVolumeChange,
  onCallRetryMicrophone,
  onCallScreenShareQualityChange,
  onCallToggleCamera,
  onCallToggleDeafen,
  onCallToggleMediaEncryption,
  onCallToggleMute,
  onCallToggleNoiseCancellation,
  onCallToggleScreenShare,
  onConversationNotificationMuteToggle,
  onConversationNotificationSettingsOpen,
  onCreate,
  onLogout,
  onPresenceChange,
  onPresenceStatusSelected,
  onSelect,
  onSessionUpdated,
  presenceByIdentityId = {},
  session,
}: SidebarProps) {
  const [conversationSearch, setConversationSearch] = useState('');
  const [conversationMenu, setConversationMenu] =
    useState<SidebarConversationMenuState | null>(null);
  const conversationLongPressTimerRef = useRef<number | null>(null);
  const conversationLongPressOpenedRef = useRef(false);
  useCloseOnEscape(() => setConversationMenu(null), !!conversationMenu);
  const conversationItems = useMemo(
    () =>
      conversations.map(
        (conversation) =>
          new SidebarConversation(
            conversation,
            session.identity.id,
            session.keychain,
            identityNames,
            identityPictures,
            identityProfiles,
          ),
      ),
    [
      conversations,
      identityNames,
      identityPictures,
      identityProfiles,
      session.identity.id,
      session.keychain,
    ],
  );
  const conversationPeerIdentityIds = useMemo(
    () =>
      Object.fromEntries(
        conversationItems
          .filter((conversation) => !!conversation.peerIdentityId)
          .map((conversation) => [
            conversation.resource.id,
            conversation.peerIdentityId,
          ]),
      ) as Record<string, string>,
    [conversationItems],
  );
  const conversationBannerUrls = useIdentityBannerUrls(
    identityProfiles,
    conversationPeerIdentityIds,
  );
  const filteredConversations = useMemo(() => {
    return conversationItems.filter((conversation) =>
      conversation.matches(conversationSearch),
    );
  }, [conversationItems, conversationSearch]);
  const clearConversationLongPressTimer = () => {
    if (conversationLongPressTimerRef.current === null) return;

    window.clearTimeout(conversationLongPressTimerRef.current);
    conversationLongPressTimerRef.current = null;
  };
  const canOpenConversationMenu =
    !!conversationNotificationSetting &&
    !!onConversationNotificationMuteToggle &&
    !!onConversationNotificationSettingsOpen;
  const openConversationMenu = (
    conversation: ConversationResource,
    title: string,
    target: HTMLElement,
  ) => {
    if (!canOpenConversationMenu) return;

    const rect = target.getBoundingClientRect();
    const menuHeight = 96;
    const menuWidth = 224;
    const top = Math.max(
      12,
      Math.min(rect.top, window.innerHeight - menuHeight - 12),
    );
    const left = Math.min(rect.right + 8, window.innerWidth - menuWidth - 12);

    setConversationMenu({
      conversation,
      left: Math.max(12, left),
      title,
      top,
    });
  };
  const handleConversationPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    conversation: ConversationResource,
    title: string,
  ) => {
    if (event.pointerType === 'mouse' || !canOpenConversationMenu) return;

    clearConversationLongPressTimer();
    conversationLongPressOpenedRef.current = false;
    conversationLongPressTimerRef.current = window.setTimeout(() => {
      conversationLongPressOpenedRef.current = true;
      openConversationMenu(conversation, title, event.currentTarget);
    }, 450);
  };

  useEffect(
    () => () => {
      clearConversationLongPressTimer();
    },
    [],
  );

  return (
    <aside className="ui-sidebar flex h-full min-h-0 flex-col p-4">
      <button
        onClick={onCreate}
        data-testid="create-conversation-button"
        className="ui-button ui-button-primary w-full"
      >
        {copy.sidebar.createConversation}
      </button>

      <div className="mt-5 min-h-0 flex-1 overflow-x-clip overflow-y-auto pr-1">
        <SectionTitle title={copy.sidebar.oneToOneTitle} />
        <ClearableSearchInput
          ariaLabel={copy.sidebar.searchConversations}
          className="mb-3"
          clearLabel={copy.sidebar.clearConversationSearch}
          value={conversationSearch}
          onChange={setConversationSearch}
          placeholder={copy.sidebar.searchConversations}
        />
        <div className="space-y-2">
          {filteredConversations.length === 0 && (
            <div className="border-y border-white/10 py-6 text-center text-sm text-white/55">
              {copy.sidebar.emptyConversations}
            </div>
          )}
          {filteredConversations.map((conversation, index) => {
            const resource = conversation.resource;

            return (
              <SidebarConversationListItem
                key={`${animationScopeKey ?? 'conversations'}:${resource.id}`}
                active={activeConversationId === resource.id}
                animateEntries={animateEntries}
                bannerUrl={conversationBannerUrls[resource.id]}
                canOpenMenu={canOpenConversationMenu}
                conversation={resource}
                conversationMenu={conversationMenu}
                handle={conversation.handle}
                index={index}
                loading={conversation.loading}
                notificationSetting={conversationNotificationSetting?.(
                  resource,
                )}
                onClearLongPressTimer={clearConversationLongPressTimer}
                onContextMenu={(event, selectedConversation, selectedTitle) => {
                  if (!canOpenConversationMenu) return;

                  event.preventDefault();
                  openConversationMenu(
                    selectedConversation,
                    selectedTitle,
                    event.currentTarget,
                  );
                }}
                onNotificationMuteToggle={onConversationNotificationMuteToggle}
                onNotificationSettingsOpen={
                  onConversationNotificationSettingsOpen
                }
                onPointerDown={handleConversationPointerDown}
                onSelect={(event, selectedConversation) => {
                  if (conversationLongPressOpenedRef.current) {
                    event.preventDefault();
                    conversationLongPressOpenedRef.current = false;

                    return;
                  }

                  setConversationMenu(null);
                  onSelect(selectedConversation.id);
                }}
                onMenuClose={() => setConversationMenu(null)}
                peerIdentityId={conversation.peerIdentityId}
                pictureUrl={conversation.pictureUrl}
                presence={
                  conversation.peerIdentityId
                    ? presenceByIdentityId[conversation.peerIdentityId]
                    : undefined
                }
                title={conversation.title}
              />
            );
          })}
        </div>
      </div>

      <UserProfileDropdown
        communities={communities}
        conversations={conversations}
        identityNames={identityNames}
        identityPictures={identityPictures}
        identityProfiles={identityProfiles}
        nodeNetworks={nodeNetworks}
        onLogout={onLogout}
        onPresenceChange={onPresenceChange}
        onPresenceStatusSelected={onPresenceStatusSelected}
        onSessionUpdated={onSessionUpdated}
        presence={presenceByIdentityId[session.identity.id]}
        session={session}
        activeCall={activeCall}
        onCallEnd={onCallEnd}
        onCallParticipantScreenShareVolumeChange={
          onCallParticipantScreenShareVolumeChange
        }
        onCallParticipantVolumeChange={onCallParticipantVolumeChange}
        onCallScreenShareQualityChange={onCallScreenShareQualityChange}
        onCallToggleCamera={onCallToggleCamera}
        onCallToggleDeafen={onCallToggleDeafen}
        onCallToggleMute={onCallToggleMute}
        onCallToggleMediaEncryption={onCallToggleMediaEncryption}
        onCallToggleNoiseCancellation={onCallToggleNoiseCancellation}
        onCallRetryMicrophone={onCallRetryMicrophone}
        onCallToggleScreenShare={onCallToggleScreenShare}
      />
    </aside>
  );
}
