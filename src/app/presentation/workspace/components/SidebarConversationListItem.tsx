import type { CSSProperties, MouseEvent, PointerEvent } from 'react';

import { createPortal } from 'react-dom';

import type {
  ConversationResource,
  IdentityPresence,
  NotificationScopeSetting,
} from '../../../../shared/domain/pigeonResources.types';
import type { SidebarConversationLoadingState } from './SidebarConversationLoadingState';
import type { SidebarConversationMenuState } from './SidebarConversationMenuState';

import { PresenceStatusDot } from '../../../../contexts/identities/presentation/components/presenceStatusDot';
import { NotificationScopeMenuActions } from '../../../../contexts/notifications/presentation/components/NotificationScopeMenuActions';
import { NotificationSettingsPolicy } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingsPolicy';
import { MutedNotificationsIcon } from '../../../../shared/presentation/components/MutedNotificationsIcon';
import { cx } from '../../../../shared/presentation/cx';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  sidePanelListEnterClassName,
  sidePanelListEnterStyle,
} from '../../../../shared/presentation/sidePanelListMotion';

export interface SidebarConversationListItemProps {
  active: boolean;
  animateEntries: boolean;
  bannerUrl?: string;
  canOpenMenu: boolean;
  conversation: ConversationResource;
  conversationMenu: SidebarConversationMenuState | null;
  handle: string;
  index: number;
  loading: SidebarConversationLoadingState;
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
}

export function SidebarConversationListItem({
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
      <button
        type="button"
        data-testid="conversation-list-item"
        data-conversation-id={conversation.id}
        data-conversation-title={title}
        data-banner-url={bannerUrl ?? ''}
        onClick={(event) => onSelect(event, conversation)}
        onContextMenu={(event) => {
          if (canOpenMenu) onContextMenu(event, conversation, title);
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
        <ConversationBanner bannerUrl={bannerUrl} />
        <div className="relative flex items-center gap-3">
          <ConversationAvatar
            active={active}
            loading={loading.avatar}
            peerIdentityId={peerIdentityId}
            pictureUrl={pictureUrl}
            presence={presence}
            title={title}
          />
          <ConversationDetails
            active={active}
            handle={handle}
            loading={loading}
            title={title}
          />
          {notificationsMuted && (
            <span
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-black/25 text-white/55"
              title={copy.notifications.muteConversation}
            >
              <MutedNotificationsIcon />
            </span>
          )}
          {!!conversation.unreadCount && (
            <span className="rounded-full bg-fuchsia-500 px-2 py-1 text-xs font-black text-white">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </button>
      <ConversationMenuSlot
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

function ConversationBanner({ bannerUrl }: { bannerUrl?: string }) {
  if (!bannerUrl) return null;

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

function ConversationAvatar({
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

function ConversationDetails({
  active,
  handle,
  loading,
  title,
}: {
  active: boolean;
  handle: string;
  loading: SidebarConversationLoadingState;
  title: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      {loading.title ? (
        <TextSkeleton className="h-4 w-32 max-w-[78%]" />
      ) : (
        <div className="truncate font-black">{title}</div>
      )}
      {loading.subtitle ? (
        <TextSkeleton className="mt-2 h-3 w-20 max-w-[52%]" />
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

function TextSkeleton({ className }: { className: string }) {
  return (
    <div className={cx('animate-pulse rounded-full bg-white/18', className)} />
  );
}

function ConversationMenuSlot({
  conversation,
  conversationMenu,
  notificationSetting,
  onClose,
  onNotificationMuteToggle,
  onNotificationSettingsOpen,
}: {
  conversation: ConversationResource;
  conversationMenu: SidebarConversationMenuState | null;
  notificationSetting?: NotificationScopeSetting;
  onClose: () => void;
  onNotificationMuteToggle?: (conversation: ConversationResource) => void;
  onNotificationSettingsOpen?: (
    conversation: ConversationResource,
    title: string,
  ) => void;
}) {
  if (
    conversationMenu?.conversation.id !== conversation.id ||
    !notificationSetting ||
    !onNotificationMuteToggle ||
    !onNotificationSettingsOpen
  ) {
    return null;
  }

  return (
    <ConversationMenu
      left={conversationMenu.left}
      notificationSetting={notificationSetting}
      title={conversationMenu.title}
      top={conversationMenu.top}
      onClose={onClose}
      onNotificationMuteToggle={() => onNotificationMuteToggle(conversation)}
      onNotificationSettingsOpen={() =>
        onNotificationSettingsOpen(conversation, conversationMenu.title)
      }
    />
  );
}

function ConversationMenu({
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
