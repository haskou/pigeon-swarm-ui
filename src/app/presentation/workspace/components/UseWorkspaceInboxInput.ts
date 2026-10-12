import type {
  Community,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { AcceptedNotificationState } from './AcceptedNotificationState';

export type UseWorkspaceInboxInput = {
  communities: Community[];
  notificationsOpen: boolean;
  onAccepted: (state: AcceptedNotificationState) => void;
  onAcceptedPanelClose: () => void;
  onCommunitiesReload: () => Promise<void>;
  session: Session;
};
