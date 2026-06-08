import type {
  Community,
  CommunityMembershipRequest,
  ConversationResource,
  IdentityResource,
  NotificationResource,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import type {
  IdentityNames,
  IdentityPictures,
} from '../../../identities/presentation/view-models/identityDisplay';
import { MembershipRequestCard } from './MembershipRequestCard';
import { NotificationCard } from './NotificationCard';
import type { NotificationAction } from './NotificationAction';

interface NotificationsPanelProps {
  action: NotificationAction | null;
  communities: Community[];
  communityAvatarUrls: Record<string, string>;
  communityPreviews: Record<string, Community>;
  conversations: ConversationResource[];
  currentIdentityId: string;
  error: string | null;
  notifications: NotificationResource[];
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  identityProfiles: Record<string, IdentityResource>;
  membershipAction: NotificationAction | null;
  membershipError: string | null;
  membershipRequests: CommunityMembershipRequest[];
  onAccept: (notification: NotificationResource) => void;
  onAcceptMembershipRequest: (requestId: string) => void;
  onArchive: (notificationId: string) => void;
  onClose: () => void;
  onDecline: (notificationId: string) => void;
  onDeclineMembershipRequest: (requestId: string) => void;
}

export function NotificationsPanel({
  action,
  communities,
  communityAvatarUrls,
  communityPreviews,
  conversations,
  currentIdentityId,
  error,
  identityNames,
  identityPictures,
  identityProfiles,
  membershipAction,
  membershipError,
  membershipRequests,
  notifications,
  onAccept,
  onAcceptMembershipRequest,
  onArchive,
  onClose,
  onDecline,
  onDeclineMembershipRequest,
}: NotificationsPanelProps) {
  const { close, state } = useCloseTransition(onClose);

  useCloseOnEscape(close);

  const pendingMembershipRequests = membershipRequests.filter(
    (request) => request.status === 'pending',
  );
  const notificationPreviewContext = {
    communities,
    communityAvatarUrls,
    communityPreviews,
    conversations,
    identityNames,
    identityPictures,
    identityProfiles,
  };

  return (
    <div
      className="app-overlay-scrim app-safe-area-popup fixed inset-0 z-50 bg-black/45 p-3 backdrop-blur-sm sm:p-5 lg:bg-transparent lg:backdrop-blur-none"
      data-state={state}
      onClick={close}
    >
      <section
        className="app-overlay-surface glass-panel-strong ml-auto flex h-full w-full max-w-[430px] flex-col rounded-2xl p-4 shadow-2xl shadow-black/35 lg:h-auto lg:max-h-[calc(100vh-2rem)]"
        data-state={state}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
              {copy.notifications.kicker}
            </div>
            <h2 className="mt-1 text-xl font-black text-white">
              {copy.notifications.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15"
            aria-label={copy.notifications.close}
          >
            ×
          </button>
        </div>

        {(error || membershipError) && (
          <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">
            {error ?? membershipError}
          </div>
        )}

        <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {notifications.length === 0 &&
            pendingMembershipRequests.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-sm text-white/55">
                {copy.notifications.empty}
              </div>
            )}

          {pendingMembershipRequests.map((request) => (
            <MembershipRequestCard
              communities={communities}
              currentIdentityId={currentIdentityId}
              identityNames={identityNames}
              key={request.id}
              onAccept={() => onAcceptMembershipRequest(request.id)}
              onDecline={() => onDeclineMembershipRequest(request.id)}
              request={request}
              working={
                membershipAction === 'accept' || membershipAction === 'decline'
              }
            />
          ))}

          {notifications.map((notification) => (
            <NotificationCard
              action={action}
              key={notification.id}
              notification={notification}
              onAccept={onAccept}
              onArchive={onArchive}
              onDecline={onDecline}
              previewContext={notificationPreviewContext}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
