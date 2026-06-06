import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';

import type { NodeNetwork } from '../../../../modules/networks/application/list-node-networks/ListNodeNetworks';
import type { CallSession } from '../../../../modules/calls/domain/callSession.types';
import type {
  ConversationResource,
  IdentityPresence,
  IdentityResource,
  NotificationScopeSetting,
  SelectablePresenceStatus,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { ConversationPeer } from '../../../../modules/conversations/domain/ConversationPeer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import {
  conversationTitle,
  shortId,
} from '../../../../shared/presentation/formatting';
import {
  identityBanner,
  identityDisplayName,
  type IdentityNames,
  type IdentityPictures,
} from '../../../../modules/identities/presentation/view-models/identityDisplay';
import { PresenceStatusDot } from '../../../../modules/identities/presentation/components/presenceStatusDot';
import { ClearableSearchInput } from '../../../../shared/presentation/components/ClearableSearchInput';
import { SectionTitle } from '../../../../shared/presentation/components/SectionTitle';
import { loadPublicImage } from '../../../../modules/communities/presentation/components/communityImages';
import { NotificationScopeMenuActions } from '../../../../modules/notifications/presentation/components/NotificationScopeMenuActions';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import {
  sidePanelListEnterClassName,
  sidePanelListEnterStyle,
} from '../../../../shared/presentation/sidePanelListMotion';
import { UserProfileDropdown } from './UserProfileDropdown';

interface SidebarProps {
  animateEntries?: boolean;
  animationScopeKey?: string;
  session: Session;
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
  onCallToggleNoiseCancellation?: () => void;
  onCallRetryMicrophone?: () => void;
  onCallToggleScreenShare?: () => void;
}

export function Sidebar({
  activeCall,
  activeConversationId,
  animateEntries = true,
  animationScopeKey,
  conversationNotificationSetting,
  conversations,
  identityNames,
  identityPictures,
  identityProfiles,
  presenceByIdentityId = {},
  nodeNetworks,
  onCallEnd,
  onCallParticipantScreenShareVolumeChange,
  onCallParticipantVolumeChange,
  onCallScreenShareQualityChange,
  onCallToggleCamera,
  onCallToggleDeafen,
  onCallToggleMute,
  onCallToggleNoiseCancellation,
  onCallRetryMicrophone,
  onCallToggleScreenShare,
  onConversationNotificationMuteToggle,
  onConversationNotificationSettingsOpen,
  onCreate,
  onLogout,
  onSelect,
  onSessionUpdated,
  onPresenceChange,
  onPresenceStatusSelected,
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
    <aside className="glass-panel-strong flex h-full min-h-0 flex-col rounded-none p-4">
      <button
        onClick={onCreate}
        className="glass-button rounded-2xl bg-fuchsia-500 px-4 py-3 text-sm font-black shadow-xl shadow-fuchsia-950/20"
      >
        {copy.sidebar.createConversation}
      </button>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
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
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
              {copy.sidebar.emptyConversations}
            </div>
          )}
          {filteredConversations.map((conversation, index) => {
            const title = conversationName(conversation);
            const notificationSetting =
              conversationNotificationSetting?.(conversation);

            return (
              <div
                key={`${animationScopeKey ?? 'conversations'}:${conversation.id}`}
                className={cx(
                  sidePanelListEnterClassName('left', animateEntries),
                  'relative',
                )}
                style={sidePanelListEnterStyle(index, animateEntries)}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    if (conversationLongPressOpenedRef.current) {
                      event.preventDefault();
                      conversationLongPressOpenedRef.current = false;

                      return;
                    }

                    setConversationMenu(null);
                    onSelect(conversation.id);
                  }}
                  onContextMenu={(event) => {
                    if (!canOpenConversationMenu) return;

                    event.preventDefault();
                    openConversationMenu(conversation, title, event.currentTarget);
                  }}
                  onPointerCancel={clearConversationLongPressTimer}
                  onPointerDown={(event) =>
                    handleConversationPointerDown(event, conversation, title)
                  }
                  onPointerLeave={clearConversationLongPressTimer}
                  onPointerUp={clearConversationLongPressTimer}
                  className={cx(
                    'relative w-full overflow-hidden rounded-2xl p-3 text-left transition',
                    activeConversationId === conversation.id
                      ? 'bg-white text-slate-950'
                      : 'bg-white/8 text-white hover:bg-white/14',
                  )}
                >
              {conversationBannerUrls[conversation.id] && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `linear-gradient(90deg, rgba(6,8,26,0) 0%, rgba(6,8,26,0) 50%, rgba(6,8,26,.62) 100%), url(${conversationBannerUrls[conversation.id]})`,
                    maskImage:
                      'linear-gradient(90deg, transparent 0%, transparent 42%, rgba(0,0,0,.18) 56%, rgba(0,0,0,.55) 72%, black 100%)',
                    WebkitMaskImage:
                      'linear-gradient(90deg, transparent 0%, transparent 42%, rgba(0,0,0,.18) 56%, rgba(0,0,0,.55) 72%, black 100%)',
                  }}
                />
              )}
              <div className="relative flex items-center gap-3">
                <div
                  className={cx(
                    'relative grid h-11 w-11 place-items-center overflow-visible rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-sm font-black text-slate-950',
                    activeConversationId === conversation.id &&
                      'ring-2 ring-slate-950/20',
                  )}
                >
                  <span className="absolute inset-0 grid place-items-center overflow-hidden rounded-2xl">
                    {conversationPicture(conversation) ? (
                      <img
                        src={conversationPicture(conversation)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      title.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  {conversationPeerId(conversation) && (
                    <PresenceStatusDot
                      presence={
                        presenceByIdentityId[conversationPeerId(conversation)!]
                      }
                      className="-bottom-1 -right-1"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-black">
                    {title}
                  </div>
                  <div
                    className={cx(
                      'truncate text-xs',
                      activeConversationId === conversation.id
                        ? 'text-slate-500'
                        : 'text-white/45',
                    )}
                  >
                    {conversationHandle(conversation)}
                  </div>
                </div>
                {!!conversation.unreadCount && (
                  <span className="rounded-full bg-fuchsia-500 px-2 py-1 text-xs font-black text-white">
                    {conversation.unreadCount}
                  </span>
                )}
              </div>
                </button>
                {conversationMenu?.conversation.id === conversation.id &&
                notificationSetting &&
                onConversationNotificationMuteToggle &&
                onConversationNotificationSettingsOpen ? (
                  <SidebarConversationMenu
                    left={conversationMenu.left}
                    notificationSetting={notificationSetting}
                    title={conversationMenu.title}
                    top={conversationMenu.top}
                    onClose={() => setConversationMenu(null)}
                    onNotificationMuteToggle={() => {
                      onConversationNotificationMuteToggle(conversation);
                    }}
                    onNotificationSettingsOpen={() => {
                      onConversationNotificationSettingsOpen(
                        conversation,
                        conversationMenu.title,
                      );
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <UserProfileDropdown
        identityNames={identityNames}
        identityPictures={identityPictures}
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

function SidebarConversationMenu({
  left,
  notificationSetting,
  title,
  top,
  onClose,
  onNotificationMuteToggle,
  onNotificationSettingsOpen,
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
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
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
  const [bannerUrls, setBannerUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const entries = Object.entries(identityIdsByKey)
      .map(([key, identityId]) => [key, identities[identityId]] as const)
      .filter(
        (entry): entry is readonly [string, IdentityResource] =>
          !!entry[1]?.profile.banner && !bannerUrls[entry[0]],
      );

    if (entries.length === 0) return;

    let cancelled = false;

    void Promise.all(
      entries.map(async ([key, identity]) => {
        const directBanner = identityBanner(identity);

        if (directBanner) return [key, directBanner] as const;

        const bannerCid = identity.profile.banner?.trim();

        if (!bannerCid) return null;

        const loadedBanner = await loadPublicImage(bannerCid);

        return loadedBanner ? ([key, loadedBanner] as const) : null;
      }),
    )
      .then((loaded) => {
        if (cancelled) return;

        const nextUrls = loaded.filter(
          (entry): entry is readonly [string, string] => entry !== null,
        );

        if (nextUrls.length === 0) return;

        setBannerUrls((current) => ({
          ...current,
          ...Object.fromEntries(nextUrls),
        }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [bannerUrls, identities, identityIdsByKey]);

  return bannerUrls;
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
