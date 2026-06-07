import type { CommunityInvitationNotificationResource } from './CommunityInvitationNotificationResource';
import type { ConversationInvitationNotificationResource } from './ConversationInvitationNotificationResource';
import type { MissedCallNotificationResource } from './MissedCallNotificationResource';

export type NotificationResource =
  | CommunityInvitationNotificationResource
  | ConversationInvitationNotificationResource
  | MissedCallNotificationResource;
