import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { PendingCommunityInviteLink } from '../../../../contexts/communities/presentation/view-models/communityInviteLink';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { PendingCommunityInviteDialog } from '../../../../contexts/communities/presentation/components/PendingCommunityInviteDialog';

/** Opens the invitation dialog while a link waits to be answered. */
export function PendingCommunityInviteHost({
  invite,
  onClose,
  onJoined,
  session,
}: {
  invite?: PendingCommunityInviteLink | null;
  onClose: () => void;
  onJoined: (community: Community) => void;
  session: Session;
}) {
  if (!invite) return null;

  return (
    <PendingCommunityInviteDialog
      invite={invite}
      onClose={onClose}
      onJoined={onJoined}
      session={session}
    />
  );
}
