import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';
import type {
  Community,
  CommunityInvitationNotificationResource,
  CommunityMembershipRequest,
  ConversationInvitationNotificationResource,
  MessageResource,
  NotificationResource,
} from '../../../../shared/domain/pigeonResources.types';
import type { NotificationMentionContext } from '../../../../contexts/notifications/presentation/view-models/NotificationMentionContext';

export function stableUniqueKey(values: string[]): string {
  return [...new Set(values.filter(Boolean))].sort().join('\u0000');
}

export function isPendingConversationInvitationFor(
  notification: NotificationResource,
  conversationId: string,
  recipientIdentityId: string,
): notification is ConversationInvitationNotificationResource {
  return (
    notification.state === 'pending' &&
    notification.recipientIdentityId === recipientIdentityId &&
    (notification.type === 'conversation_invitation' ||
      notification.type === 'group_conversation_invitation') &&
    notification.payload.conversationId === conversationId
  );
}

export function isPendingCommunityInvitationFor(
  notification: NotificationResource,
  communityId: string,
  recipientIdentityId: string,
): notification is CommunityInvitationNotificationResource {
  return (
    notification.state === 'pending' &&
    notification.recipientIdentityId === recipientIdentityId &&
    notification.type === 'community_invitation' &&
    notification.payload.communityId === communityId
  );
}

function stringArrayAttribute(
  event: RealtimeDomainEvent,
  ...names: string[]
): string[] {
  for (const name of names) {
    const value = event.attributes[name];

    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }
  }

  return [];
}

function booleanAttribute(
  event: RealtimeDomainEvent,
  ...names: string[]
): boolean {
  return names.some((name) => event.attributes[name] === true);
}

export function canActOnMembershipRequest(
  request: CommunityMembershipRequest,
  communities: Community[],
  currentIdentityId: string,
): boolean {
  if (request.status !== 'pending') return false;

  if (request.type === 'invitation') {
    return request.identityId === currentIdentityId;
  }

  return communities.some(
    (community) =>
      community.id === request.communityId &&
      community.ownerIdentityId === currentIdentityId,
  );
}

export function notificationMentionContext(input: {
  currentIdentityId: string;
  currentRoleIds?: string[];
  event: RealtimeDomainEvent;
  message?: MessageResource;
}): NotificationMentionContext {
  const mentions = input.message?.mentions ?? [];
  const mentionedIdentityIds = [
    ...stringArrayAttribute(
      input.event,
      'mentionedIdentityIds',
      'mentioned_identity_ids',
    ),
    ...mentions
      .filter((mention) => mention.type === 'identity')
      .map((mention) => mention.targetId),
  ];
  const mentionedRoleIds = [
    ...stringArrayAttribute(
      input.event,
      'mentionedRoleIds',
      'mentioned_role_ids',
    ),
    ...mentions
      .filter((mention) => mention.type === 'role')
      .map((mention) => mention.targetId),
  ];

  return {
    currentIdentityId: input.currentIdentityId,
    currentRoleIds: input.currentRoleIds,
    mentionedIdentityIds,
    mentionedRoleIds,
    mentionedRoleMemberIds: stringArrayAttribute(
      input.event,
      'mentionedRoleMemberIds',
      'mentioned_role_member_ids',
    ),
    mentionsEveryoneOrHere:
      booleanAttribute(
        input.event,
        'mentionsEveryoneOrHere',
        'mentions_everyone_or_here',
      ) ||
      mentions.some(
        (mention) => mention.type === 'everyone' || mention.type === 'here',
      ),
  };
}
