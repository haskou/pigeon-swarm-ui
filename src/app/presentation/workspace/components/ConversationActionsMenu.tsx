import type { CallParticipant } from '../../../../modules/calls/domain/callSession.types';
import type {
  ConversationResource,
  NotificationScopeSetting,
} from '../../../../shared/domain/pigeonResources.types';

import { NotificationScopeMenuActions } from '../../../../modules/notifications/presentation/components/NotificationScopeMenuActions';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';

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
  useCloseOnEscape(onClose);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-30 cursor-default"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <div className="absolute right-0 top-[calc(100%+.5rem)] z-40 min-w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#15172d] p-1 text-sm shadow-2xl shadow-black/40">
        {onStartCall && !isGroupConversation ? (
          <button
            type="button"
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
              onClose();
            }}
            className="block w-full rounded-2xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
          >
            {copy.calls.startCall}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            onOpenPins();
            onClose();
          }}
          className="block w-full rounded-2xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10 sm:hidden"
        >
          {copy.messages.viewPinned}
        </button>
        <NotificationScopeMenuActions
          muteLabel={copy.notifications.muteConversation}
          notificationSetting={notificationSetting}
          onNotificationMuteToggle={() => {
            onNotificationMuteToggle();
            onClose();
          }}
          onNotificationSettingsOpen={() => {
            onNotificationSettingsOpen();
            onClose();
          }}
        />
        <button
          type="button"
          onClick={() => {
            onConversationDataOpen();
            onClose();
          }}
          className="block w-full rounded-2xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
        >
          {copy.chat.viewData}
        </button>
        {canShareConversationKey ? (
          <button
            type="button"
            onClick={() => {
              onConversationKeyOpen();
              onClose();
            }}
            className="block w-full rounded-2xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
          >
            {hasConversationKey
              ? copy.chat.copyPrivateKey
              : copy.chat.addPrivateKey}
          </button>
        ) : null}
        {isGroupConversation && hasConversationKey ? (
          <button
            type="button"
            onClick={() => {
              onGroupInviteOpen();
              onClose();
            }}
            className="block w-full rounded-2xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
          >
            {copy.chat.invite}
          </button>
        ) : null}
      </div>
    </>
  );
}
