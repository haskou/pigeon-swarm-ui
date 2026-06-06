import type { ConversationInvitationPayload } from '../../conversations/domain/conversationResources.types';
import type { BaseNotificationResource } from './BaseNotificationResource';

export type ConversationInvitationNotificationResource =
  BaseNotificationResource & {
    payload: ConversationInvitationPayload;
    type: 'conversation_invitation' | 'group_conversation_invitation';
  };
