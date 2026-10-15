import type { CommunityInvitationNotificationResource } from './CommunityInvitationNotificationResource';
import type { ConversationInvitationNotificationResource } from './ConversationInvitationNotificationResource';
import type { GroupConversationInvitationNotificationResource } from './GroupConversationInvitationNotificationResource';
import type { MissedCallNotificationResource } from './MissedCallNotificationResource';

export type NotificationResource =
  | CommunityInvitationNotificationResource
  | ConversationInvitationNotificationResource
  | GroupConversationInvitationNotificationResource
  | MissedCallNotificationResource;
