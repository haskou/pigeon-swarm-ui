import { type ReactNode, useRef } from 'react';

import type { CallParticipant } from '../../../../modules/calls/domain/callSession.types';
import type {
  ConversationResource,
  NotificationScopeSetting,
} from '../../../../shared/domain/pigeonResources.types';

import { NotificationScopeMenuActions } from '../../../../modules/notifications/presentation/components/NotificationScopeMenuActions';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';

interface ConversationActionsMenuProps {
  activeConversation: ConversationResource;
  activeConversationName?: string;
  activeConversationTitle?: string;
  callParticipants: CallParticipant[];
  canShareConversationKey: boolean;
  hasConversationKey: boolean;
  isGroupConversation: boolean;
  notificationSetting: NotificationScopeSetting;
  onClose: () => void;
  onConversationDataOpen: () => void;
  onConversationKeyOpen: () => void;
  onNotificationSettingsOpen: () => void;
  onNotificationMuteToggle: () => void;
  onGroupInviteOpen: () => void;
  onOpenPins: () => void;
  onStartCall?: (input: {
    conversationId: string;
    kind: 'group' | 'one-to-one';
    participants: CallParticipant[];
    title: string;
  }) => void;
}

export function ConversationActionsMenu({
  activeConversation,
  activeConversationName,
  activeConversationTitle,
  callParticipants,
  canShareConversationKey,
  hasConversationKey,
  isGroupConversation,
  notificationSetting,
  onClose,
  onConversationDataOpen,
  onConversationKeyOpen,
  onNotificationSettingsOpen,
  onNotificationMuteToggle,
  onGroupInviteOpen,
  onOpenPins,
  onStartCall,
}: ConversationActionsMenuProps) {
  const { close, state } = useCloseTransition(onClose);
  const openedAtRef = useRef(Date.now());

  useCloseOnEscape(close);

  const closeAfterOpeningSettles = () => {
    if (Date.now() - openedAtRef.current < 250) return;

    close();
  };

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
        {onStartCall && !isGroupConversation ? (
          <ConversationHeaderMenuAction
            icon={<CallMenuIcon />}
            label={copy.calls.startCall}
            onClick={() => {
              onStartCall({
                conversationId: activeConversation.id,
                kind: 'one-to-one',
                participants: callParticipants,
                title:
                  activeConversationTitle ??
                  activeConversationName ??
                  activeConversation.id,
              });
              close();
            }}
          />
        ) : null}
        <ConversationHeaderMenuAction
          icon={<PinMenuIcon />}
          label={copy.messages.viewPinned}
          onClick={() => {
            onOpenPins();
            close();
          }}
          className="sm:hidden"
        />
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
        <ConversationHeaderMenuAction
          icon={<DataMenuIcon />}
          label={copy.chat.viewData}
          onClick={() => {
            onConversationDataOpen();
            close();
          }}
        />
        {canShareConversationKey ? (
          <ConversationHeaderMenuAction
            icon={<KeyMenuIcon />}
            label={
              hasConversationKey
                ? copy.chat.copyPrivateKey
                : copy.chat.addPrivateKey
            }
            onClick={() => {
              onConversationKeyOpen();
              close();
            }}
          />
        ) : null}
        {isGroupConversation && hasConversationKey ? (
          <ConversationHeaderMenuAction
            icon={<InviteMenuIcon />}
            label={copy.chat.invite}
            onClick={() => {
              onGroupInviteOpen();
              close();
            }}
          />
        ) : null}
      </div>
    </>
  );
}

function ConversationHeaderMenuAction({
  className,
  icon,
  label,
  onClick,
}: {
  className?: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10',
        className ?? '',
      ].join(' ')}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

function CallMenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 shrink-0 text-white/55"
    >
      <path
        d="M8.5 5.5 10 9l-2 1.5a10.8 10.8 0 0 0 5.5 5.5l1.5-2 3.5 1.5v2.7c0 .8-.6 1.4-1.4 1.4A13.6 13.6 0 0 1 3.4 6.9c0-.8.6-1.4 1.4-1.4h2.7Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
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

function InviteMenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 shrink-0 text-white/55"
    >
      <path
        d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 19a4.5 4.5 0 0 1 9 0M16.5 7.5v6M13.5 10.5h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
