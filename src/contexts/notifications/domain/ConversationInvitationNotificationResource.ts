import type { ConversationInvitationPayload } from '../infrastructure/http/resources/ConversationInvitationPayload';
import type { BaseNotificationResource } from './BaseNotificationResource';

export type ConversationInvitationNotificationResource =
  BaseNotificationResource & {
    payload: ConversationInvitationPayload;
    type: 'conversation_invitation' | 'group_conversation_invitation';
  };
