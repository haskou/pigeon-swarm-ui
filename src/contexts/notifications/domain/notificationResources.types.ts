import type { CommunityInvitationPayload } from '../../communities/domain/communityResources.types';
import type { ConversationInvitationPayload } from '../../conversations/domain/conversationResources.types';

export type MissedCallPayload = {
  callId: string;
  callerIdentityId: string;
  networkId: string;
  recipientIdentityId: string;
};

type BaseNotificationResource = {
  createdAt: string;
  id: string;
  recipientIdentityId: string;
  state: 'accepted' | 'declined' | 'pending';
  status: 'read' | 'unread';
};

export type ConversationInvitationNotificationResource =
  BaseNotificationResource & {
    payload: ConversationInvitationPayload;
    type: 'conversation_invitation' | 'group_conversation_invitation';
  };

export type CommunityInvitationNotificationResource =
  BaseNotificationResource & {
    payload: CommunityInvitationPayload;
    type: 'community_invitation';
  };

export type MissedCallNotificationResource = BaseNotificationResource & {
  payload: MissedCallPayload;
  type: 'missed_call';
};

export type NotificationResource =
  | CommunityInvitationNotificationResource
  | ConversationInvitationNotificationResource
  | MissedCallNotificationResource;
