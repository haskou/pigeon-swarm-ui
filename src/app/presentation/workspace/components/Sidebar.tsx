import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';

import type { CallSession } from '../../../../contexts/calls/domain/callSession.types';
import type { NodeNetwork } from '../../../../contexts/networks/application/list-node-networks/ListNodeNetworks';
import type {
  Community,
  ConversationResource,
  IdentityPresence,
  IdentityResource,
  NotificationScopeSetting,
  SelectablePresenceStatus,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { loadPublicImage } from '../../../../contexts/communities/presentation/components/communityImages';
import { ConversationPeer } from '../../../../contexts/conversations/presentation/view-models/ConversationPeer';
import { PresenceStatusDot } from '../../../../contexts/identities/presentation/components/presenceStatusDot';
import {
  identityBanner,
  identityDisplayName,
  type IdentityNames,
  type IdentityPictures,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import { NotificationSettingsPolicy } from '../../../../contexts/notifications/domain/NotificationSettingsPolicy';
import { NotificationScopeMenuActions } from '../../../../contexts/notifications/presentation/components/NotificationScopeMenuActions';
import { ClearableSearchInput } from '../../../../shared/presentation/components/ClearableSearchInput';
import { SectionTitle } from '../../../../shared/presentation/components/SectionTitle';
import { cx } from '../../../../shared/presentation/cx';
import {
  conversationTitle,
  shortId,
} from '../../../../shared/presentation/formatting';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  sidePanelListEnterClassName,
  sidePanelListEnterStyle,
} from '../../../../shared/presentation/sidePanelListMotion';
import { MutedNotificationsIcon } from '../../../../shared/presentation/components/MutedNotificationsIcon';
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
  onCallToggleMute,
  onCallToggleMediaEncryption,
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
    useState<ConversationMenuState | null>(null);
  const conversationLongPressTimerRef = useRef<number | null>(null);
  const conversationLongPressOpenedRef = useRef(false);
  useCloseOnEscape(() => setConversationMenu(null), !!conversationMenu);
  const conversationBannerUrls = useIdentityBannerUrls(
    identityProfiles,
    filteredConversationPeerIdentityIds(
      conversations,
      session.identity.id,
      session.keychain,
    ),
  );
  const conversationPeerId = (conversation: ConversationResource) =>
    ConversationPeer.identityId(
      conversation,
      session.identity.id,
      session.keychain,
    );

  const conversationName = (conversation: ConversationResource) => {
    if (isGroupConversation(conversation)) {
      return conversation.name ?? conversation.title ?? conversation.id;
    }

    const peerIdentityId = conversationPeerId(conversation);
    const peerProfile = peerIdentityId
      ? identityProfiles[peerIdentityId]?.profile
      : undefined;
    const peerName = peerProfile?.name.trim();
    const peerHandle = peerProfile?.handle?.trim();

    return peerName
      ? peerName
      : peerHandle
        ? `@${peerHandle}`
        : peerIdentityId
          ? identityDisplayName(peerIdentityId, identityNames)
          : conversationTitle(conversation);
  };
  const conversationHandle = (conversation: ConversationResource) => {
    if (isGroupConversation(conversation)) {
      const memberCount = conversationParticipants(conversation).length;

      return `${memberCount} ${copy.sidebar.members}`;
    }

    const peerIdentityId = conversationPeerId(conversation);
    const peerHandle = peerIdentityId
      ? identityProfiles[peerIdentityId]?.profile.handle?.trim()
      : undefined;

    return peerHandle
      ? `@${peerHandle}`
      : peerIdentityId
        ? shortId(peerIdentityId)
        : conversationTitle(conversation);
  };
  const conversationPicture = (conversation: ConversationResource) => {
    if (isGroupConversation(conversation)) return undefined;

    const peerIdentityId = conversationPeerId(conversation);

    return peerIdentityId ? identityPictures[peerIdentityId] : undefined;
  };
  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();

    if (!query) return conversations;

    return conversations.filter((conversation) => {
      const peerIdentityId = conversationPeerId(conversation);
      const searchable = [
        conversation.id,
        conversationName(conversation),
        conversationHandle(conversation),
        peerIdentityId ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [conversationSearch, conversations, identityNames, identityProfiles]);
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
            const title = conversationName(conversation);
            const peerIdentityId = conversationPeerId(conversation);

            return (
              <SidebarConversationListItem
                key={`${animationScopeKey ?? 'conversations'}:${conversation.id}`}
                active={activeConversationId === conversation.id}
                animateEntries={animateEntries}
                bannerUrl={conversationBannerUrls[conversation.id]}
                canOpenMenu={canOpenConversationMenu}
                conversation={conversation}
                conversationMenu={conversationMenu}
                handle={conversationHandle(conversation)}
                index={index}
                loading={conversationIdentityLoadingState({
                  conversation,
                  identityNames,
                  identityPictures,
                  identityProfiles,
                  peerIdentityId,
                })}
                notificationSetting={conversationNotificationSetting?.(
                  conversation,
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
                peerIdentityId={peerIdentityId}
                pictureUrl={conversationPicture(conversation)}
                presence={
                  peerIdentityId
                    ? presenceByIdentityId[peerIdentityId]
                    : undefined
                }
                title={title}
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

type ConversationMenuState = {
  conversation: ConversationResource;
  left: number;
  title: string;
  top: number;
};

type SidebarConversationListItemProps = {
  active: boolean;
  animateEntries: boolean;
  bannerUrl?: string;
  canOpenMenu: boolean;
  conversation: ConversationResource;
  conversationMenu: ConversationMenuState | null;
  handle: string;
  index: number;
  loading: ConversationIdentityLoadingState;
  notificationSetting?: NotificationScopeSetting;
  onClearLongPressTimer: () => void;
  onContextMenu: (
    event: MouseEvent<HTMLButtonElement>,
    conversation: ConversationResource,
    title: string,
  ) => void;
  onMenuClose: () => void;
  onNotificationMuteToggle?: (conversation: ConversationResource) => void;
  onNotificationSettingsOpen?: (
    conversation: ConversationResource,
    title: string,
  ) => void;
  onPointerDown: (
    event: PointerEvent<HTMLButtonElement>,
    conversation: ConversationResource,
    title: string,
  ) => void;
  onSelect: (
    event: MouseEvent<HTMLButtonElement>,
    conversation: ConversationResource,
  ) => void;
  peerIdentityId?: string;
  pictureUrl?: string;
  presence?: IdentityPresence;
  title: string;
};

function SidebarConversationListItem({
  active,
  animateEntries,
  bannerUrl,
  canOpenMenu,
  conversation,
  conversationMenu,
  handle,
  index,
  loading,
  notificationSetting,
  onClearLongPressTimer,
  onContextMenu,
  onMenuClose,
  onNotificationMuteToggle,
  onNotificationSettingsOpen,
  onPointerDown,
  onSelect,
  peerIdentityId,
  pictureUrl,
  presence,
  title,
}: SidebarConversationListItemProps) {
  const notificationsMuted = notificationSetting
    ? NotificationSettingsPolicy.isMuted(notificationSetting)
    : false;

  return (
    <div
      className={cx(
        sidePanelListEnterClassName('left', animateEntries),
        'relative',
      )}
      style={sidePanelListEnterStyle(index, animateEntries)}
    >
      <SidebarConversationButton
        active={active}
        bannerUrl={bannerUrl}
        canOpenMenu={canOpenMenu}
        conversation={conversation}
        handle={handle}
        loading={loading}
        notificationsMuted={notificationsMuted}
        onClearLongPressTimer={onClearLongPressTimer}
        onContextMenu={onContextMenu}
        onPointerDown={onPointerDown}
        onSelect={onSelect}
        peerIdentityId={peerIdentityId}
        pictureUrl={pictureUrl}
        presence={presence}
        title={title}
      />
      <SidebarConversationMenuSlot
        conversation={conversation}
        conversationMenu={conversationMenu}
        notificationSetting={notificationSetting}
        onClose={onMenuClose}
        onNotificationMuteToggle={onNotificationMuteToggle}
        onNotificationSettingsOpen={onNotificationSettingsOpen}
      />
    </div>
  );
}

type SidebarConversationButtonProps = {
  active: boolean;
  bannerUrl?: string;
  canOpenMenu: boolean;
  conversation: ConversationResource;
  handle: string;
  loading: ConversationIdentityLoadingState;
  notificationsMuted: boolean;
  onClearLongPressTimer: () => void;
  onContextMenu: (
    event: MouseEvent<HTMLButtonElement>,
    conversation: ConversationResource,
    title: string,
  ) => void;
  onPointerDown: (
    event: PointerEvent<HTMLButtonElement>,
    conversation: ConversationResource,
    title: string,
  ) => void;
  onSelect: (
    event: MouseEvent<HTMLButtonElement>,
    conversation: ConversationResource,
  ) => void;
  peerIdentityId?: string;
  pictureUrl?: string;
  presence?: IdentityPresence;
  title: string;
};

function SidebarConversationButton({
  active,
  bannerUrl,
  canOpenMenu,
  conversation,
  handle,
  loading,
  notificationsMuted,
  onClearLongPressTimer,
  onContextMenu,
  onPointerDown,
  onSelect,
  peerIdentityId,
  pictureUrl,
  presence,
  title,
}: SidebarConversationButtonProps) {
  return (
    <button
      type="button"
      data-testid="conversation-list-item"
      data-conversation-id={conversation.id}
      data-conversation-title={title}
      data-banner-url={bannerUrl ?? ''}
      onClick={(event) => onSelect(event, conversation)}
      onContextMenu={(event) => {
        if (!canOpenMenu) return;

        onContextMenu(event, conversation, title);
      }}
      onPointerCancel={onClearLongPressTimer}
      onPointerDown={(event) => onPointerDown(event, conversation, title)}
      onPointerLeave={onClearLongPressTimer}
      onPointerUp={onClearLongPressTimer}
      className={cx(
        'ui-navigation-row p-3 text-left',
        active ? 'is-active' : '',
      )}
    >
      <SidebarConversationBanner bannerUrl={bannerUrl} hidden={false} />
      <div className="relative flex items-center gap-3">
        <SidebarConversationAvatar
          active={active}
          loading={loading.avatar}
          peerIdentityId={peerIdentityId}
          pictureUrl={pictureUrl}
          presence={presence}
          title={title}
        />
        <SidebarConversationDetails
          active={active}
          handle={handle}
          loading={loading}
          title={title}
        />
        {notificationsMuted && (
          <span
            className={cx(
              'grid h-6 w-6 shrink-0 place-items-center rounded-full',
              'bg-black/25 text-white/55',
            )}
            title={copy.notifications.muteConversation}
          >
            <MutedNotificationsIcon />
          </span>
        )}
        <SidebarUnreadCount unreadCount={conversation.unreadCount} />
      </div>
    </button>
  );
}

function SidebarConversationBanner({
  bannerUrl,
  hidden,
}: {
  bannerUrl?: string;
  hidden: boolean;
}) {
  if (!bannerUrl || hidden) return null;

  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 bg-cover bg-center"
      style={{
        backgroundImage: `linear-gradient(90deg, rgba(6,8,26,0) 0%, rgba(6,8,26,0) 50%, rgba(6,8,26,.62) 100%), url(${bannerUrl})`,
        maskImage:
          'linear-gradient(90deg, transparent 0%, transparent 42%, rgba(0,0,0,.18) 56%, rgba(0,0,0,.55) 72%, black 100%)',
        WebkitMaskImage:
          'linear-gradient(90deg, transparent 0%, transparent 42%, rgba(0,0,0,.18) 56%, rgba(0,0,0,.55) 72%, black 100%)',
      }}
    />
  );
}

function SidebarConversationAvatar({
  active,
  loading,
  peerIdentityId,
  pictureUrl,
  presence,
  title,
}: {
  active: boolean;
  loading: boolean;
  peerIdentityId?: string;
  pictureUrl?: string;
  presence?: IdentityPresence;
  title: string;
}) {
  if (loading) {
    return (
      <span className="h-11 w-11 shrink-0 animate-pulse rounded-lg bg-gradient-to-br from-cyan-300/70 to-fuchsia-400/70" />
    );
  }

  return (
    <div
      className={cx(
        'relative grid h-11 w-11 place-items-center overflow-visible rounded-lg bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-sm font-black text-slate-950',
        active && 'ring-2 ring-slate-950/20',
      )}
    >
      <span className="absolute inset-0 grid place-items-center overflow-hidden rounded-lg">
        {pictureUrl ? (
          <img src={pictureUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          title.slice(0, 1).toUpperCase()
        )}
      </span>
      {peerIdentityId && (
        <PresenceStatusDot presence={presence} className="-bottom-1 -right-1" />
      )}
    </div>
  );
}

function SidebarConversationDetails({
  active,
  handle,
  loading,
  title,
}: {
  active: boolean;
  handle: string;
  loading: ConversationIdentityLoadingState;
  title: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      {loading.title ? (
        <SidebarTextSkeleton active={active} className="h-4 w-32 max-w-[78%]" />
      ) : (
        <div className="truncate font-black">{title}</div>
      )}
      {loading.subtitle ? (
        <SidebarTextSkeleton
          active={active}
          className="mt-2 h-3 w-20 max-w-[52%]"
          secondary
        />
      ) : (
        <div
          className={cx(
            'truncate text-xs',
            active ? 'text-white/55' : 'text-white/45',
          )}
        >
          {handle}
        </div>
      )}
    </div>
  );
}

function SidebarTextSkeleton({
  active,
  className,
  secondary = false,
}: {
  active: boolean;
  className: string;
  secondary?: boolean;
}) {
  return (
    <div
      className={cx(
        'animate-pulse rounded-full',
        active
          ? secondary
            ? 'bg-white/12'
            : 'bg-white/18'
          : secondary
            ? 'bg-white/12'
            : 'bg-white/18',
        className,
      )}
    />
  );
}

function SidebarUnreadCount({ unreadCount }: { unreadCount?: number }) {
  if (!unreadCount) return null;

  return (
    <span className="rounded-full bg-fuchsia-500 px-2 py-1 text-xs font-black text-white">
      {unreadCount}
    </span>
  );
}

function SidebarConversationMenuSlot({
  conversation,
  conversationMenu,
  notificationSetting,
  onClose,
  onNotificationMuteToggle,
  onNotificationSettingsOpen,
}: {
  conversation: ConversationResource;
  conversationMenu: ConversationMenuState | null;
  notificationSetting?: NotificationScopeSetting;
  onClose: () => void;
  onNotificationMuteToggle?: (conversation: ConversationResource) => void;
  onNotificationSettingsOpen?: (
    conversation: ConversationResource,
    title: string,
  ) => void;
}) {
  if (
    !conversationMenu ||
    conversationMenu.conversation.id !== conversation.id
  ) {
    return null;
  }

  if (
    !notificationSetting ||
    !onNotificationMuteToggle ||
    !onNotificationSettingsOpen
  ) {
    return null;
  }

  return (
    <SidebarConversationMenu
      left={conversationMenu.left}
      notificationSetting={notificationSetting}
      title={conversationMenu.title}
      top={conversationMenu.top}
      onClose={onClose}
      onNotificationMuteToggle={() => {
        onNotificationMuteToggle(conversation);
      }}
      onNotificationSettingsOpen={() => {
        onNotificationSettingsOpen(conversation, conversationMenu.title);
      }}
    />
  );
}

type ConversationIdentityLoadingState = {
  avatar: boolean;
  subtitle: boolean;
  title: boolean;
};

function conversationIdentityLoadingState({
  conversation,
  identityNames,
  identityPictures,
  identityProfiles,
  peerIdentityId,
}: {
  conversation: ConversationResource;
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  identityProfiles: Record<string, IdentityResource>;
  peerIdentityId?: string;
}): ConversationIdentityLoadingState {
  const loaded = {
    avatar: false,
    subtitle: false,
    title: false,
  };

  if (isGroupConversation(conversation)) return loaded;

  if (!peerIdentityId) return loaded;

  if (identityProfiles[peerIdentityId]) return loaded;

  const identityName = identityNames[peerIdentityId];
  const hasKnownName = !!identityName && identityName !== peerIdentityId;

  return {
    avatar: !identityPictures[peerIdentityId],
    subtitle: true,
    title: !hasKnownName,
  };
}

function SidebarConversationMenu({
  left,
  notificationSetting,
  onClose,
  onNotificationMuteToggle,
  onNotificationSettingsOpen,
  title,
  top,
}: {
  left: number;
  notificationSetting: NotificationScopeSetting;
  title: string;
  top: number;
  onClose: () => void;
  onNotificationMuteToggle: () => void;
  onNotificationSettingsOpen: () => void;
}) {
  const { close, state } = useCloseTransition(onClose);
  useCloseOnEscape(close);

  const menuStyle = {
    left,
    top,
    touchAction: 'manipulation',
    userSelect: 'none',
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
  } as CSSProperties;

  return createPortal(
    <>
      <button
        type="button"
        className="app-overlay-scrim fixed inset-0 z-[80] cursor-default select-none"
        data-state={state}
        onClick={close}
        onContextMenu={(event) => {
          event.preventDefault();
          close();
        }}
        style={{
          userSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
        }}
        aria-label={copy.dialog.close}
      />
      <section
        className="message-context-menu app-context-menu fixed z-[90] max-h-[calc(100dvh-1rem)] min-w-56 max-w-[calc(100vw-1rem)] select-none overflow-y-auto rounded-2xl border border-white/10 bg-[#15172d] p-1 text-left text-sm shadow-2xl shadow-black/40"
        data-state={state}
        style={menuStyle}
        onContextMenu={(event) => event.preventDefault()}
        aria-label={title}
      >
        <NotificationScopeMenuActions
          muteLabel={copy.notifications.muteConversation}
          notificationSetting={notificationSetting}
          onNotificationMuteToggle={() => {
            onNotificationMuteToggle();
            close();
          }}
          onNotificationSettingsOpen={() => {
            onNotificationSettingsOpen();
            close();
          }}
        />
      </section>
    </>,
    document.body,
  );
}

function filteredConversationPeerIdentityIds(
  conversations: ConversationResource[],
  currentIdentityId: string,
  keychain: Session['keychain'],
): Record<string, string> {
  return Object.fromEntries(
    conversations
      .map((conversation) => [
        conversation.id,
        ConversationPeer.identityId(conversation, currentIdentityId, keychain),
      ])
      .filter((entry): entry is [string, string] => !!entry[1]),
  );
}

function useIdentityBannerUrls(
  identities: Record<string, IdentityResource>,
  identityIdsByKey: Record<string, string>,
): Record<string, string> {
  const [bannerUrls, setBannerUrls] = useState<
    Record<string, { bannerId: string; url: string }>
  >({});

  useEffect(() => {
    const entries = Object.entries(identityIdsByKey)
      .map(([key, identityId]) => {
        const identity = identities[identityId];
        const bannerId = identity?.profile.banner?.trim();

        return [key, identity, bannerId] as const;
      })
      .filter(
        (entry): entry is readonly [string, IdentityResource, string] =>
          !!entry[1] &&
          !!entry[2] &&
          bannerUrls[entry[0]]?.bannerId !== entry[2],
      );

    setBannerUrls((current) => {
      const validBannerIdsByKey = Object.fromEntries(
        Object.entries(identityIdsByKey).map(([key, identityId]) => [
          key,
          identities[identityId]?.profile.banner?.trim() ?? '',
        ]),
      );
      const next = Object.fromEntries(
        Object.entries(current).filter(
          ([key, banner]) => validBannerIdsByKey[key] === banner.bannerId,
        ),
      );

      return Object.keys(next).length === Object.keys(current).length
        ? current
        : next;
    });

    if (entries.length === 0) return;

    let cancelled = false;

    void Promise.all(
      entries.map(async ([key, identity, bannerId]) => {
        const directBanner = identityBanner(identity);

        if (directBanner) return [key, bannerId, directBanner] as const;

        const bannerCid = bannerId;

        if (!bannerCid) return null;

        const loadedBanner = await loadPublicImage(bannerCid);

        return loadedBanner ? ([key, bannerId, loadedBanner] as const) : null;
      }),
    )
      .then((loaded) => {
        if (cancelled) return;

        const nextUrls = loaded.filter(
          (entry): entry is readonly [string, string, string] => entry !== null,
        );

        if (nextUrls.length === 0) return;

        setBannerUrls((current) => ({
          ...current,
          ...Object.fromEntries(
            nextUrls.map(([key, bannerId, url]) => [
              key,
              {
                bannerId,
                url,
              },
            ]),
          ),
        }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [bannerUrls, identities, identityIdsByKey]);

  return Object.fromEntries(
    Object.entries(bannerUrls).map(([key, banner]) => [key, banner.url]),
  );
}

function isGroupConversation(conversation: ConversationResource): boolean {
  return conversation.type === 'group' || conversation.id.startsWith('group:');
}

function conversationParticipants(
  conversation: ConversationResource,
): string[] {
  return (
    conversation.participantIdentityIds ??
    conversation.participantIds ??
    conversation.participants ??
    []
  );
}
