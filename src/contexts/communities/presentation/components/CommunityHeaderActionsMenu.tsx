import { type ReactNode, useEffect, useRef } from 'react';

import type { NotificationScopeSetting } from '../../../../shared/domain/pigeonResources.types';

import { NotificationScopeMenuActions } from '../../../notifications/presentation/components/NotificationScopeMenuActions';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';

type CommunityHeaderActionsMenuProps = {
  communityLeaving: boolean;
  hasCommunityKey: boolean;
  notificationSetting: NotificationScopeSetting;
  open: boolean;
  showCommunityKeyAction?: boolean;
  onClose: () => void;
  onAddMember?: () => void;
  onCommunityDataOpen: () => void;
  onCommunityKeyOpen: () => void;
  onLeaveCommunity: () => void;
  onNotificationSettingsOpen: () => void;
  onNotificationMuteToggle: () => void;
  onOpenPins?: () => void;
  onRealtimeEventsOpen?: () => void;
};

export function CommunityHeaderActionsMenu({
  communityLeaving,
  hasCommunityKey,
  notificationSetting,
  open,
  showCommunityKeyAction = true,
  onClose,
  onAddMember,
  onCommunityDataOpen,
  onCommunityKeyOpen,
  onLeaveCommunity,
  onNotificationSettingsOpen,
  onNotificationMuteToggle,
  onOpenPins,
  onRealtimeEventsOpen,
}: CommunityHeaderActionsMenuProps): ReactNode {
  const { close, state } = useCloseTransition(onClose);
  const openedAtRef = useRef(Date.now());

  useCloseOnEscape(close, open);

  useEffect(() => {
    if (open) openedAtRef.current = Date.now();
  }, [open]);

  const closeAfterOpeningSettles = () => {
    if (Date.now() - openedAtRef.current < 250) return;

    close();
  };

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="app-overlay-scrim fixed inset-0 z-30 cursor-default"
        data-state={state}
        onClick={closeAfterOpeningSettles}
        onContextMenu={(event) => {
          event.preventDefault();
          closeAfterOpeningSettles();
        }}
        aria-label={copy.dialog.close}
      />
      <div
        className="app-context-menu absolute right-0 top-[calc(100%+.5rem)] z-40 min-w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#15172d] p-1 text-sm shadow-2xl shadow-black/40"
        data-state={state}
      >
        {onAddMember ? (
          <CommunityHeaderMenuAction
            className="xl:hidden"
            icon={<AddMemberMenuIcon />}
            label={copy.communities.addMember}
            onClick={() => {
              onAddMember();
              close();
            }}
          />
        ) : null}
        {onOpenPins ? (
          <CommunityHeaderMenuAction
            icon={<PinMenuIcon />}
            label={copy.messages.viewPinned}
            onClick={() => {
              onOpenPins();
              close();
            }}
            className="sm:hidden"
          />
        ) : null}
        {onRealtimeEventsOpen ? (
          <CommunityHeaderMenuAction
            icon={<RealtimeEventsMenuIcon />}
            label={copy.chat.viewRealtimeEvents}
            onClick={() => {
              onRealtimeEventsOpen();
              close();
            }}
            className="sm:hidden"
          />
        ) : null}
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
        <CommunityHeaderMenuAction
          icon={<DataMenuIcon />}
          label={copy.chat.viewData}
          onClick={onCommunityDataOpen}
        />
        {showCommunityKeyAction ? (
          <CommunityHeaderMenuAction
            icon={<KeyMenuIcon />}
            label={
              hasCommunityKey
                ? copy.chat.copyPrivateKey
                : copy.chat.addPrivateKey
            }
            onClick={onCommunityKeyOpen}
          />
        ) : null}
        <CommunityHeaderMenuAction
          disabled={communityLeaving}
          icon={<LeaveMenuIcon />}
          label={
            communityLeaving ? copy.communities.leaving : copy.communities.leave
          }
          onClick={onLeaveCommunity}
          tone="danger"
        />
      </div>
    </>
  );
}

function AddMemberMenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 shrink-0 text-white/55"
    >
      <path
        d="M15.5 19a6.5 6.5 0 0 0-13 0M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM18.5 8v6M15.5 11h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CommunityHeaderMenuAction({
  className,
  disabled = false,
  icon,
  label,
  onClick,
  tone = 'default',
}: {
  className?: string;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'danger' | 'default';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left font-black transition disabled:cursor-not-allowed disabled:text-white/30 disabled:hover:bg-transparent',
        tone === 'danger'
          ? 'text-rose-100 hover:bg-rose-500/10'
          : 'text-white/80 hover:bg-white/10',
        className ?? '',
      ].join(' ')}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

function PinMenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 shrink-0 text-white/55"
    >
      <path
        d="M14.4 4.8 19.2 9.6M9.2 13.2l-4.4 4.4M8 5.2l10.8 10.8M8.8 5.8l-1.7 5.6 5.5 5.5 5.6-1.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function DataMenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 shrink-0 text-white/55"
    >
      <path
        d="M12 11.5v5M12 7.5h.01M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function RealtimeEventsMenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 shrink-0 text-white/55"
    >
      <path
        d="M4.5 7.5h15M4.5 12h15M4.5 16.5h15M7.5 5.5v13M16.5 5.5v13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function KeyMenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 shrink-0 text-white/55"
    >
      <path
        d="M14.5 9.5a4.5 4.5 0 1 1-2.1-3.8l5.4 5.4 1.9-.1.2 2.2 2.1.2v2.4h-2.7l-1.8-1.8-1.8 1.8-2.2-2.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M7.5 10.5h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function LeaveMenuIcon() {
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
