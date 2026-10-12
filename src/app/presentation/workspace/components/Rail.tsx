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

import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { NotificationScopeSettingResource as NotificationScopeSetting } from '../../../../contexts/notifications/infrastructure/http/resources/NotificationScopeSettingResource';
import type { CommunityMenuState } from './CommunityMenuState';

import { CommunityList } from '../../../../contexts/communities/presentation/view-models/CommunityList';
import { publicFileObjectUrl } from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import { NotificationScopeMenuActions } from '../../../../contexts/notifications/presentation/components/NotificationScopeMenuActions';
import { NotificationSettingsPolicy } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingsPolicy';
import { FallbackImage } from '../../../../shared/presentation/components/FallbackImage';
import { MutedNotificationsIcon } from '../../../../shared/presentation/components/MutedNotificationsIcon';
import { cx } from '../../../../shared/presentation/cx';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import {
  type InstallState,
  useInstallPrompt,
} from '../../../../shared/presentation/hooks/useInstallPrompt';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { applicationContainer } from '../../../composition/applicationContainer';

export interface RailProps {
  activeMessages?: boolean;
  className?: string;
  communities?: Community[];
  communityNotificationSetting?: (
    community: Community,
  ) => NotificationScopeSetting;
  communityUnreadCounts?: Record<string, number>;
  activeCommunityId?: null | string;
  messageNotificationCount?: number;
  notificationCount?: number;
  onCommunityClick?: (communityId: string) => void;
  onCommunityLeave?: (community: Community) => Promise<void> | void;
  onCommunityNotificationMuteToggle?: (community: Community) => void;
  onCommunityNotificationSettingsOpen?: (community: Community) => void;
  onCreateCommunityClick?: () => void;
  onInspectorClick?: () => void;
  onMessagesClick?: () => void;
  onNotificationsClick?: () => void;
  onSettingsClick?: () => void;
  peerCount?: number;
  settingsAttention?: boolean;
}

function isIosBrowser(): boolean {
  return /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase());
}

function installFallbackHelp(installState: InstallState): string {
  if (installState === 'checking') return copy.auth.installAppChecking;

  if (import.meta.env.DEV) return copy.auth.installAppDevHelp;

  if (isIosBrowser()) return copy.auth.installAppIosHelp;

  return copy.auth.installAppHelp;
}

function installButtonTitle(installState: InstallState): string {
  if (installState === 'ready') return copy.auth.installApp;

  if (installState === 'checking') return copy.auth.installAppChecking;

  if (installState === 'prompting') return copy.auth.installAppPrompting;

  return copy.auth.installAppInstructions;
}

async function loadRailAvatar(cid: string): Promise<null | string> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const content = await applicationContainer.attachments.getPublicFile(cid);

      return publicFileObjectUrl(content);
    } catch {
      await new Promise((resolve) =>
        window.setTimeout(resolve, 250 * (attempt + 1)),
      );
    }
  }

  return null;
}

function isCommunityNotificationMuted(
  notificationSetting?: NotificationScopeSetting,
): boolean {
  return notificationSetting
    ? NotificationSettingsPolicy.isMuted(notificationSetting)
    : false;
}

function RailBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="pointer-events-none absolute right-0 top-0 z-20 min-w-5 rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-center text-[0.65rem] font-black leading-none text-white shadow-[0_0_12px_rgba(217,70,239,0.55)]">
      {count > 9 ? '9+' : count}
    </span>
  );
}

function RailCountPill({ count }: { count: number }) {
  return (
    <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-[0.65rem] font-black leading-none text-white">
      {count > 9 ? '9+' : count}
    </span>
  );
}

function RailSelectionIndicator({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <span
      aria-hidden="true"
      className="absolute top-1/2 h-8 w-1 -translate-y-1/2 bg-fuchsia-400 shadow-[0_0_14px_rgba(232,121,249,0.7)]"
      style={{ left: 'calc(50% - 2.25rem)' }}
    />
  );
}

function RailLeaveIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 shrink-0 text-rose-100/70"
    >
      <path
        d="M10 6H6.8A2.8 2.8 0 0 0 4 8.8v6.4A2.8 2.8 0 0 0 6.8 18H10M14.5 8.5 18 12m0 0-3.5 3.5M18 12H9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function InstallIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M8 4.75h8A1.75 1.75 0 0 1 17.75 6.5v11A1.75 1.75 0 0 1 16 19.25H8a1.75 1.75 0 0 1-1.75-1.75v-11A1.75 1.75 0 0 1 8 4.75Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 8v5.5m0 0 2-2m-2 2-2-2M10.75 16.25h2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function InstallHelpDialog({
  body,
  onClose,
  title,
}: {
  body: string;
  onClose: () => void;
  title: string;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4 backdrop-blur-md">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section
        className="glass-panel-strong relative w-full max-w-sm rounded-2xl p-5 text-left shadow-2xl shadow-black/40"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">{body}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15"
            aria-label={copy.dialog.close}
          >
            ×
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function RailInstallControls({
  installHelpOpen,
  installState,
  onCloseInstallHelp,
  onInstallApp,
}: {
  installHelpOpen: boolean;
  installState: InstallState;
  onCloseInstallHelp: () => void;
  onInstallApp: () => Promise<void>;
}) {
  const showInstallApp = installState !== 'installed';
  const installButtonReady = installState === 'ready';
  const installButtonChecking = installState === 'checking';
  const installButtonPrompting = installState === 'prompting';
  const installButtonDisabled = installButtonChecking || installButtonPrompting;
  const title = installButtonTitle(installState);

  return (
    <>
      {showInstallApp && (
        <button
          type="button"
          onClick={onInstallApp}
          aria-busy={installButtonPrompting}
          disabled={installButtonDisabled}
          className={cx(
            'relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/65 transition hover:bg-white/12 hover:text-white disabled:cursor-wait disabled:opacity-55 disabled:hover:bg-white/5 disabled:hover:text-white/65',
            installButtonReady &&
              'border-cyan-200/30 bg-cyan-300/10 text-cyan-100',
            installButtonPrompting && 'cursor-wait opacity-70',
          )}
          aria-label={title}
          title={title}
        >
          <InstallIcon />
        </button>
      )}
      {installHelpOpen && showInstallApp && (
        <InstallHelpDialog
          body={installFallbackHelp(installState)}
          onClose={onCloseInstallHelp}
          title={copy.auth.installAppInstructions}
        />
      )}
    </>
  );
}

function CommunityRailAvatar({ community }: { community: Community }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const avatar = community.avatar?.trim();

    setAvatarUrl(null);

    if (!avatar) return undefined;

    let cancelled = false;

    void loadRailAvatar(avatar).then((url) => {
      if (!cancelled) setAvatarUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [community.avatar]);

  return (
    <FallbackImage
      src={avatarUrl}
      alt=""
      className="pointer-events-none h-full w-full select-none object-cover"
      draggable={false}
      fallback={community.name.slice(0, 1).toUpperCase()}
    />
  );
}

function CommunityRailMenu({
  communityName,
  ignoreBackdropClicksUntil,
  left,
  notificationSetting,
  onClose,
  onCommunityLeave,
  onNotificationMuteToggle,
  onNotificationSettingsOpen,
  top,
}: {
  communityName: string;
  ignoreBackdropClicksUntil: number;
  left: number;
  notificationSetting?: NotificationScopeSetting;
  top: number;
  onClose: () => void;
  onCommunityLeave?: () => void;
  onNotificationMuteToggle?: () => void;
  onNotificationSettingsOpen?: () => void;
}) {
  const { close, state } = useCloseTransition(onClose);
  const closeFromBackdrop = (event: MouseEvent<HTMLButtonElement>) => {
    if (performance.now() < ignoreBackdropClicksUntil) {
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    close();
  };
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
        onClick={closeFromBackdrop}
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
        aria-label={communityName}
      >
        {notificationSetting &&
        onNotificationMuteToggle &&
        onNotificationSettingsOpen ? (
          <NotificationScopeMenuActions
            muteLabel={copy.notifications.muteCommunity}
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
        ) : null}
        {onCommunityLeave ? (
          <>
            {notificationSetting ? (
              <div className="my-1 h-px bg-white/10" />
            ) : null}
            <button
              type="button"
              onClick={() => {
                onCommunityLeave();
                close();
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left font-black text-rose-200 transition hover:bg-rose-500/15 active:bg-rose-400/25 active:text-white"
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center text-rose-100/70">
                <RailLeaveIcon />
              </span>
              <span className="min-w-0 flex-1 truncate">
                {copy.communities.leave}
              </span>
            </button>
          </>
        ) : null}
      </section>
    </>,
    document.body,
  );
}

function RailMutedBadge({ muted }: { muted: boolean }) {
  if (!muted) return null;

  return (
    <span className="pointer-events-none absolute bottom-0 right-[calc(50%-1.7rem)] z-20 grid h-5 w-5 place-items-center rounded-full border border-[#1b1d38] bg-[#1b1d38] text-white/65">
      <MutedNotificationsIcon className="h-3 w-3" />
    </span>
  );
}

function RailCommunityMenuSlot({
  canConfigureNotifications,
  canOpenCommunityMenu,
  community,
  menu,
  notificationSetting,
  onClose,
  onCommunityLeave,
  onNotificationMuteToggle,
  onNotificationSettingsOpen,
}: {
  canConfigureNotifications: boolean;
  canOpenCommunityMenu: boolean;
  community: Community;
  menu: CommunityMenuState | null;
  notificationSetting?: NotificationScopeSetting;
  onClose: () => void;
  onCommunityLeave?: (community: Community) => Promise<void> | void;
  onNotificationMuteToggle?: (community: Community) => void;
  onNotificationSettingsOpen?: (community: Community) => void;
}) {
  if (!canOpenCommunityMenu || menu?.communityId !== community.id) return null;

  return (
    <CommunityRailMenu
      communityName={community.name}
      ignoreBackdropClicksUntil={menu.ignoreBackdropClicksUntil}
      left={menu.left}
      notificationSetting={notificationSetting}
      top={menu.top}
      onClose={onClose}
      onCommunityLeave={
        onCommunityLeave
          ? () => {
              void onCommunityLeave(community);
              onClose();
            }
          : undefined
      }
      onNotificationMuteToggle={
        canConfigureNotifications && onNotificationMuteToggle
          ? () => {
              onNotificationMuteToggle(community);
              onClose();
            }
          : undefined
      }
      onNotificationSettingsOpen={
        canConfigureNotifications && onNotificationSettingsOpen
          ? () => {
              onNotificationSettingsOpen(community);
              onClose();
            }
          : undefined
      }
    />
  );
}

function RailCommunityItem({
  active,
  community,
  menu,
  notificationSetting,
  onClick,
  onCloseMenu,
  onCommunityLeave,
  onCommunityNotificationMuteToggle,
  onCommunityNotificationSettingsOpen,
  onContextMenu,
  onPointerDown,
  onPointerEnd,
  unreadCount,
}: {
  active: boolean;
  community: Community;
  menu: CommunityMenuState | null;
  notificationSetting?: NotificationScopeSetting;
  onClick: (event: MouseEvent<HTMLButtonElement>, communityId: string) => void;
  onCloseMenu: () => void;
  onCommunityLeave?: (community: Community) => Promise<void> | void;
  onCommunityNotificationMuteToggle?: (community: Community) => void;
  onCommunityNotificationSettingsOpen?: (community: Community) => void;
  onContextMenu: (
    event: MouseEvent<HTMLButtonElement>,
    communityId: string,
    canOpenCommunityMenu: boolean,
  ) => void;
  onPointerDown: (
    event: PointerEvent<HTMLButtonElement>,
    communityId: string,
    canOpenCommunityMenu: boolean,
  ) => void;
  onPointerEnd: () => void;
  unreadCount: number;
}) {
  const notificationsMuted = isCommunityNotificationMuted(notificationSetting);
  const canConfigureNotifications =
    !!notificationSetting &&
    !!onCommunityNotificationSettingsOpen &&
    !!onCommunityNotificationMuteToggle;
  const canOpenCommunityMenu = canConfigureNotifications || !!onCommunityLeave;

  return (
    <div className="group relative flex w-full justify-center">
      <RailSelectionIndicator active={active} />
      <button
        type="button"
        onClick={(event) => onClick(event, community.id)}
        onContextMenu={(event) =>
          onContextMenu(event, community.id, canOpenCommunityMenu)
        }
        onDragStart={(event) => event.preventDefault()}
        onPointerCancel={onPointerEnd}
        onPointerDown={(event) =>
          onPointerDown(event, community.id, canOpenCommunityMenu)
        }
        onPointerLeave={onPointerEnd}
        onPointerUp={onPointerEnd}
        title={community.name}
        className={cx(
          'grid h-12 w-12 shrink-0 select-none place-items-center rounded-2xl bg-white/10 font-black text-white/75 transition [-webkit-touch-callout:none]',
          active && 'bg-white/15',
          notificationsMuted && 'opacity-60 saturate-75',
        )}
        aria-label={community.name}
      >
        <span className="pointer-events-none grid h-full w-full select-none place-items-center overflow-hidden rounded-2xl">
          <CommunityRailAvatar community={community} />
        </span>
      </button>
      <RailMutedBadge muted={notificationsMuted} />
      <RailCommunityMenuSlot
        canConfigureNotifications={canConfigureNotifications}
        canOpenCommunityMenu={canOpenCommunityMenu}
        community={community}
        menu={menu}
        notificationSetting={notificationSetting}
        onClose={onCloseMenu}
        onCommunityLeave={onCommunityLeave}
        onNotificationMuteToggle={onCommunityNotificationMuteToggle}
        onNotificationSettingsOpen={onCommunityNotificationSettingsOpen}
      />
      <RailBadge count={unreadCount} />
    </div>
  );
}

function RailInspectorButton({
  onClick,
  peerCount,
}: {
  onClick: () => void;
  peerCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative mt-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white/75 transition hover:bg-white/15"
      aria-label={copy.inspector.open}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5"
      >
        <path
          d="M5 6.5h14M5 12h10M5 17.5h7"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
      {peerCount > 0 && <RailCountPill count={peerCount} />}
    </button>
  );
}

function RailSettingsButton({
  attention,
  onClick,
  pushToBottom,
}: {
  attention: boolean;
  onClick?: () => void;
  pushToBottom: boolean;
}) {
  const label = attention
    ? `${copy.nodeSettings.open} · ${copy.nodeSettings.unclaimed}`
    : copy.nodeSettings.open;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'relative grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white/75 transition hover:bg-white/15',
        pushToBottom && 'mt-auto',
      )}
      aria-label={label}
      title={label}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5"
      >
        <path
          d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M19.35 13.15v-2.3l-2.05-.42a5.8 5.8 0 0 0-.58-1.4l1.15-1.75-1.62-1.62-1.75 1.15a5.8 5.8 0 0 0-1.4-.58L12.7 4h-2.3l-.4 2.05a5.8 5.8 0 0 0-1.42.58L6.85 5.48 5.23 7.1l1.15 1.75a5.8 5.8 0 0 0-.58 1.4l-2.05.42v2.3l2.05.42c.12.5.32.98.58 1.4l-1.15 1.75 1.62 1.62 1.75-1.15c.44.26.92.46 1.42.58l.4 2.05h2.3l.4-2.05c.5-.12.98-.32 1.4-.58l1.75 1.15 1.62-1.62-1.15-1.75c.26-.44.46-.92.58-1.4l2.03-.24Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
      {attention && (
        <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-[#1b1d38] bg-fuchsia-500" />
      )}
    </button>
  );
}

export function Rail({
  activeCommunityId = null,
  activeMessages = false,
  className,
  communities = [],
  communityNotificationSetting,
  communityUnreadCounts = {},
  messageNotificationCount = 0,
  notificationCount = 0,
  onCommunityClick,
  onCommunityLeave,
  onCommunityNotificationMuteToggle,
  onCommunityNotificationSettingsOpen,
  onCreateCommunityClick,
  onInspectorClick,
  onMessagesClick,
  onNotificationsClick,
  onSettingsClick,
  peerCount = 0,
  settingsAttention = false,
}: RailProps) {
  const visibleCommunities = useMemo(
    () => CommunityList.withUniqueIds(communities),
    [communities],
  );
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [communityMenu, setCommunityMenu] = useState<null | CommunityMenuState>(
    null,
  );
  const communityLongPressTimerRef = useRef<number | null>(null);
  const communityLongPressOpenedRef = useRef(false);
  const { installState, requestInstall } = useInstallPrompt();
  const closeCommunityMenu = (): void => setCommunityMenu(null);

  useCloseOnEscape(closeCommunityMenu, !!communityMenu);

  const clearCommunityLongPressTimer = () => {
    if (communityLongPressTimerRef.current === null) {
      return;
    }

    window.clearTimeout(communityLongPressTimerRef.current);
    communityLongPressTimerRef.current = null;
  };

  useEffect(
    () => () => {
      clearCommunityLongPressTimer();
    },
    [],
  );

  const openCommunityMenu = (
    communityId: string,
    target: HTMLElement,
    ignoreBackdropClicksForMs = 0,
  ) => {
    const rect = target.getBoundingClientRect();
    const menuHeight = 176;
    const menuWidth = 224;
    const top = Math.max(
      12,
      Math.min(rect.top, window.innerHeight - menuHeight - 12),
    );
    const left = Math.min(rect.right + 8, window.innerWidth - menuWidth - 12);

    setCommunityMenu({
      communityId,
      ignoreBackdropClicksUntil:
        ignoreBackdropClicksForMs > 0
          ? performance.now() + ignoreBackdropClicksForMs
          : 0,
      left: Math.max(12, left),
      top,
    });
  };
  const handleCommunityPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    communityId: string,
    canOpenCommunityMenu: boolean,
  ) => {
    if (event.pointerType === 'mouse' || !canOpenCommunityMenu) {
      return;
    }

    clearCommunityLongPressTimer();
    communityLongPressOpenedRef.current = false;
    const target = event.currentTarget;
    communityLongPressTimerRef.current = window.setTimeout(() => {
      communityLongPressOpenedRef.current = true;
      openCommunityMenu(communityId, target, 650);
    }, 450);
  };
  const handleCommunityClick = (
    event: MouseEvent<HTMLButtonElement>,
    communityId: string,
  ): void => {
    if (communityLongPressOpenedRef.current) {
      event.preventDefault();
      communityLongPressOpenedRef.current = false;

      return;
    }

    onCommunityClick?.(communityId);
  };
  const handleCommunityContextMenu = (
    event: MouseEvent<HTMLButtonElement>,
    communityId: string,
    canOpenCommunityMenu: boolean,
  ): void => {
    event.preventDefault();
    event.stopPropagation();

    if (!canOpenCommunityMenu) return;

    openCommunityMenu(communityId, event.currentTarget);
  };

  const handleInstallApp = async () => {
    if (installState === 'fallback') {
      setInstallHelpOpen(true);

      return;
    }

    const installOutcome = await requestInstall();

    if (installOutcome === 'accepted') {
      setInstallHelpOpen(false);

      return;
    }

    setInstallHelpOpen(false);
  };

  return (
    <aside
      className={cx(
        'glass-panel flex h-full flex-col items-center gap-3 rounded-none px-1 py-3',
        className,
      )}
    >
      <div className="relative flex w-full justify-center">
        <RailSelectionIndicator active={activeMessages} />
        <button
          type="button"
          onClick={onMessagesClick}
          className="relative rounded-2xl transition hover:scale-[1.03]"
          aria-label={copy.rail.openMessages}
        >
          <img
            src="/logo.png"
            alt="Pigeon Swarm"
            draggable={false}
            className="h-14 w-14 rounded-2xl shadow-xl"
          />
        </button>
        <RailBadge count={messageNotificationCount} />
      </div>
      <div className="h-px w-10 bg-white/10" />
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto overflow-x-visible">
        {visibleCommunities.map((community) => (
          <RailCommunityItem
            key={community.id}
            active={activeCommunityId === community.id}
            community={community}
            menu={communityMenu}
            notificationSetting={communityNotificationSetting?.(community)}
            onClick={handleCommunityClick}
            onCloseMenu={closeCommunityMenu}
            onCommunityLeave={onCommunityLeave}
            onCommunityNotificationMuteToggle={
              onCommunityNotificationMuteToggle
            }
            onCommunityNotificationSettingsOpen={
              onCommunityNotificationSettingsOpen
            }
            onContextMenu={handleCommunityContextMenu}
            onPointerDown={handleCommunityPointerDown}
            onPointerEnd={clearCommunityLongPressTimer}
            unreadCount={communityUnreadCounts[community.id] ?? 0}
          />
        ))}
        <button
          type="button"
          onClick={onCreateCommunityClick}
          className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-dashed border-white/25 bg-white/5 text-2xl font-black text-white/60 transition hover:bg-white/12 hover:text-white"
          aria-label={copy.communities.createTooltip}
          title={copy.communities.createTooltip}
        >
          +<span className="sr-only">{copy.communities.createTooltip}</span>
        </button>
      </div>
      <RailInstallControls
        installHelpOpen={installHelpOpen}
        installState={installState}
        onCloseInstallHelp={() => setInstallHelpOpen(false)}
        onInstallApp={handleInstallApp}
      />
      <button
        type="button"
        onClick={onNotificationsClick}
        data-testid="notifications-open-button"
        className="relative grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white/75 transition hover:bg-white/15"
        aria-label={copy.notifications.open}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5"
        >
          <path
            d="M18 9.5a6 6 0 0 0-12 0v3.2L4.7 15a1 1 0 0 0 .9 1.5h12.8a1 1 0 0 0 .9-1.5L18 12.7V9.5Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <path
            d="M9.6 19a2.6 2.6 0 0 0 4.8 0"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
        {notificationCount > 0 && <RailCountPill count={notificationCount} />}
      </button>
      {onInspectorClick && (
        <RailInspectorButton onClick={onInspectorClick} peerCount={peerCount} />
      )}
      <RailSettingsButton
        attention={settingsAttention}
        onClick={onSettingsClick}
        pushToBottom={!onInspectorClick}
      />
    </aside>
  );
}
