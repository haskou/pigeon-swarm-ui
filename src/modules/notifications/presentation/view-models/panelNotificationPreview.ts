import type {
  Community,
  IdentityResource,
  NotificationResource,
} from '../../../../domain/types';

import { copy } from '../../../../i18n/en';
import { shortId } from '../../../../utils/formatting';
import {
  identityDisplayName,
} from '../../../../utils/identityDisplay';
import type {
  NotificationPreview,
  NotificationPreviewContext,
} from './panelNotificationPreview.types';

export function notificationPreview(
  notification: NotificationResource,
  context: NotificationPreviewContext,
): NotificationPreview {
  if (notification.type === 'community_invitation') {
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

  if (notification.type === 'conversation_invitation') {
    return identityNotificationPreview(
      notification.payload.inviterIdentityId,
      context,
    );
  }

  if (notification.type === 'group_conversation_invitation') {
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

  if (notification.type === 'missed_call') {
    return identityNotificationPreview(
      notification.payload.callerIdentityId,
      context,
    );
  }

  return { title: copy.notifications.invitationTitle };
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
  const cachedName = splitCachedIdentityName(context.identityNames[identityId]);

  return {
    avatarUrl: context.identityPictures[identityId],
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
