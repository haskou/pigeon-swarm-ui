import type {
  Community,
  CommunityMembershipRequest,
  ConversationResource,
  IdentityResource,
  NotificationResource,
} from '../../../../shared/domain/pigeonResources.types';
import type { NodeNetwork } from '../../../networks/application/list-node-networks/ListNodeNetworks';
import type {
  IdentityNames,
  IdentityPictures,
} from '../../../identities/presentation/view-models/identityDisplay';
import type { NotificationAction } from './NotificationAction';

import { useState } from 'react';

import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { identityDisplayName } from '../../../identities/presentation/view-models/identityDisplay';
import { UserProfileDialog } from '../../../identities/presentation/components/UserProfileDialog';
import { MembershipRequestCard } from './MembershipRequestCard';
import { NotificationCard } from './NotificationCard';

interface NotificationsPanelProps {
  action: NotificationAction | null;
  communities: Community[];
  communityAvatarUrls: Record<string, string>;
  communityPreviews: Record<string, Community>;
  conversations: ConversationResource[];
  currentIdentityId: string;
  error: string | null;
  notifications: NotificationResource[];
  nodeNetworks: NodeNetwork[];
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
  nodeNetworks,
  onAccept,
  onAcceptMembershipRequest,
  onArchive,
  onClose,
  onDecline,
  onDeclineMembershipRequest,
}: NotificationsPanelProps) {
  const { close, state } = useCloseTransition(onClose);
  const [profileIdentityId, setProfileIdentityId] = useState<string | null>(
    null,
  );

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
        className="app-overlay-surface ui-dialog-surface ml-auto flex h-full w-full max-w-[430px] flex-col text-white lg:h-auto lg:max-h-[calc(100vh-2rem)]"
        data-state={state}
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader
          kicker={copy.notifications.kicker}
          title={copy.notifications.title}
          onClose={close}
        />

        {(error || membershipError) && (
          <div className="ui-inline-notice mx-5 mt-4 border-rose-300/50 bg-rose-500/10 text-rose-100">
            {error ?? membershipError}
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {notifications.length === 0 &&
            pendingMembershipRequests.length === 0 && (
              <div className="py-10 text-center text-sm text-white/55">
                {copy.notifications.empty}
              </div>
            )}

          {pendingMembershipRequests.map((request) => (
            <MembershipRequestCard
              communities={communities}
              currentIdentityId={currentIdentityId}
              identityNames={identityNames}
              identityProfiles={identityProfiles}
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
              onIdentityOpen={setProfileIdentityId}
              previewContext={notificationPreviewContext}
            />
          ))}
        </div>
      </section>
      {profileIdentityId && (
        <UserProfileDialog
          identity={identityProfiles[profileIdentityId]}
          identityId={profileIdentityId}
          name={identityDisplayName(profileIdentityId, identityNames)}
          nodeNetworks={nodeNetworks}
          onClose={() => setProfileIdentityId(null)}
          picture={identityPictures[profileIdentityId]}
        />
      )}
    </div>
  );
}
