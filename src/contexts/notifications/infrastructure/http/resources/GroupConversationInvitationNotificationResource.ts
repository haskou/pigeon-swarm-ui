import type { BaseNotificationResource } from './BaseNotificationResource';
import type { GroupConversationInvitationPayload } from './GroupConversationInvitationPayload';

export type GroupConversationInvitationNotificationResource =
  BaseNotificationResource & {
    payload: GroupConversationInvitationPayload;
    type: 'group_conversation_invitation';
  };
