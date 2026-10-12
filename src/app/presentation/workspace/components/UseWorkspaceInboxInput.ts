import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { AcceptedNotificationState } from './AcceptedNotificationState';

export type UseWorkspaceInboxInput = {
  communities: Community[];
  notificationsOpen: boolean;
  onAccepted: (state: AcceptedNotificationState) => void;
  onAcceptedPanelClose: () => void;
  onCommunitiesReload: () => Promise<void>;
  session: Session;
};
