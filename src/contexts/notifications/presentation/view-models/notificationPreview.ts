import type { NotificationResource } from '../../../../shared/domain/pigeonResources.types';
import type { CommunityInvitationNotificationResource } from '../../domain/CommunityInvitationNotificationResource';
import type { ConversationInvitationNotificationResource } from '../../domain/ConversationInvitationNotificationResource';
import type {
  NotificationPreview,
  NotificationPreviewContext,
} from './panelNotificationPreview.types';

import { shortId } from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { identityDisplayName } from '../../../identities/presentation/view-models/identityDisplay';

export function notificationPreview(
  notification: NotificationResource,
  context: NotificationPreviewContext,
): NotificationPreview {
  switch (notification.type) {
    case 'community_invitation':
      return communityInvitationPreview(notification, context);
    case 'conversation_invitation':
      return identityNotificationPreview(
        notification.payload.inviterIdentityId,
        context,
      );
    case 'group_conversation_invitation':
      return groupConversationInvitationPreview(notification, context);
    case 'missed_call':
      return identityNotificationPreview(
        notification.payload.callerIdentityId,
        context,
      );
    default:
      return { title: copy.notifications.invitationTitle };
  }
}

function communityInvitationPreview(
  notification: CommunityInvitationNotificationResource,
  context: NotificationPreviewContext,
): NotificationPreview {
  const community =
    context.communityPreviews[notification.payload.communityId] ??
    context.communities.find(
      (item) => item.id === notification.payload.communityId,
    );

  return {
    avatarUrl: context.communityAvatarUrls[notification.payload.communityId],
    subtitle:
      community?.description ||
      `${community?.memberIds.length ?? 0} ${copy.communities.members}`,
    title:
      community?.name ??
      `${copy.notifications.community} ${shortId(notification.payload.communityId)}`,
  };
}

function groupConversationInvitationPreview(
  notification: ConversationInvitationNotificationResource,
  context: NotificationPreviewContext,
): NotificationPreview {
  const conversation = context.conversations.find(
    (item) => item.id === notification.payload.conversationId,
  );

  return {
    subtitle: shortId(notification.payload.conversationId),
    title:
      conversation?.name ??
      conversation?.title ??
      copy.notifications.groupInvitationTitle,
  };
}

function identityNotificationPreview(
  identityId: string,
  context: Pick<
    NotificationPreviewContext,
    'identityNames' | 'identityPictures' | 'identityProfiles'
  >,
): NotificationPreview {
  const identity = context.identityProfiles[identityId];
  const name = identity?.profile.name.trim();
  const handle = identity?.profile.handle?.trim();
  const cachedRawName = context.identityNames[identityId];
  const cachedName = splitCachedIdentityName(cachedRawName);
  const loading = !identity && (!cachedRawName || cachedRawName === identityId);

  return {
    avatarUrl: context.identityPictures[identityId],
    loading,
    subtitle: handle ? `@${handle}` : (cachedName.handle ?? identityId),
    title:
      name ||
      cachedName.name ||
      (handle
        ? `@${handle}`
        : identityDisplayName(identityId, context.identityNames)),
  };
}

function splitCachedIdentityName(value?: string): {
  handle?: string;
  name?: string;
} {
  if (!value) return {};

  const match = /^(.*?)\s+\(@([^)]+)\)$/.exec(value.trim());

  if (!match) return { name: value };

  return { handle: `@${match[2]}`, name: match[1] };
}
