import type { BaseNotificationResource } from './BaseNotificationResource';
import type { ConversationInvitationPayload } from './ConversationInvitationPayload';

export type ConversationInvitationNotificationResource =
  BaseNotificationResource & {
    payload: ConversationInvitationPayload;
    type: 'conversation_invitation' | 'group_conversation_invitation';
  };
