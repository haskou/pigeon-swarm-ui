import type {
  Community,
  ConversationResource,
  IdentityResource,
  NotificationResource,
} from '../../domain/types';

import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { formatTime, shortId } from '../../utils/formatting';
import {
  identityDisplayName,
  type IdentityNames,
  type IdentityPictures,
} from '../../utils/identityDisplay';

type NotificationAction = 'accept' | 'archive' | 'decline' | 'refresh';

interface NotificationsPanelProps {
  action: NotificationAction | null;
  communities: Community[];
  communityAvatarUrls: Record<string, string>;
  communityPreviews: Record<string, Community>;
  conversations: ConversationResource[];
  error: string | null;
  notifications: NotificationResource[];
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  identityProfiles: Record<string, IdentityResource>;
  onAccept: (notification: NotificationResource) => void;
  onArchive: (notificationId: string) => void;
  onClose: () => void;
  onDecline: (notificationId: string) => void;
}

function notificationTitle(notification: NotificationResource): string {
  if (notification.type === 'missed_call') {
    return copy.notifications.missedCallTitle;
  }

  if (notification.type === 'community_invitation') {
    return copy.notifications.communityInvitationTitle;
  }

  if (notification.type === 'group_conversation_invitation') {
    return copy.notifications.groupInvitationTitle;
  }

  return copy.notifications.invitationTitle;
}

function notificationTarget(notification: NotificationResource): {
  label: string;
  value: string;
} {
  if (notification.type === 'community_invitation') {
    return {
      label: copy.notifications.community,
      value: notification.payload.communityId,
    };
  }

  if (notification.type === 'missed_call') {
    return {
      label: copy.notifications.call,
      value: notification.payload.callId,
    };
  }

  return {
    label: copy.notifications.conversation,
    value: notification.payload.conversationId,
  };
}

export function NotificationsPanel({
  action,
  communities,
  communityAvatarUrls,
  communityPreviews,
  conversations,
  error,
  identityNames,
  identityPictures,
  identityProfiles,
  notifications,
  onAccept,
  onArchive,
  onClose,
  onDecline,
}: NotificationsPanelProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 p-3 backdrop-blur-sm sm:p-5 lg:bg-transparent lg:backdrop-blur-none"
      onClick={onClose}
    >
      <section
        className="glass-panel-strong ml-auto flex h-full w-full max-w-[430px] flex-col rounded-2xl p-4 shadow-2xl shadow-black/35 lg:h-auto lg:max-h-[calc(100vh-2rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
              {copy.notifications.kicker}
            </div>
            <h2 className="mt-1 text-xl font-black text-white">
              {copy.notifications.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15"
            aria-label={copy.notifications.close}
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {notifications.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/7 p-4 text-sm text-white/55">
              {copy.notifications.empty}
            </div>
          )}

          {notifications.map((notification) => {
            const target = notificationTarget(notification);
            const preview = notificationPreview(notification, {
              communities,
              communityAvatarUrls,
              communityPreviews,
              conversations,
              identityNames,
              identityPictures,
              identityProfiles,
            });
            const inviterIdentityId =
              notification.type === 'missed_call'
                ? notification.payload.callerIdentityId
                : notification.payload.inviterIdentityId;
            const canRespond =
              notification.state === 'pending' &&
              notification.type !== 'missed_call';

            return (
              <article
                key={notification.id}
                className="rounded-2xl border border-white/10 bg-black/25 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-black text-white">
                      {notificationTitle(notification)}
                    </h3>
                    <p className="mt-1 text-sm text-white/55">
                      {notification.type === 'missed_call'
                        ? copy.notifications.calledBy
                        : copy.notifications.invitedBy}{' '}
                      <span className="font-semibold text-white/75">
                        {identityDisplayName(inviterIdentityId, identityNames)}
                      </span>
                    </p>
                  </div>
                  <span
                    className={cx(
                      'shrink-0 rounded-full px-2.5 py-1 text-xs font-black',
                      notification.state === 'pending'
                        ? 'bg-cyan-300/15 text-cyan-100'
                        : 'bg-white/10 text-white/55',
                    )}
                  >
                    {copy.notifications.states[notification.state]}
                  </span>
                </div>

                <div className="mt-3 rounded-2xl bg-white/7 p-3 text-xs text-white/55">
                  <div className="mb-3 flex items-center gap-3 border-b border-white/10 pb-3">
                    <PreviewAvatar preview={preview} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-white/85">
                        {preview.title}
                      </div>
                      {preview.subtitle && (
                        <div className="mt-1 line-clamp-2 text-xs font-semibold text-white/50">
                          {preview.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>{target.label}</span>
                    <span className="truncate font-semibold text-white/70">
                      {shortId(target.value)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span>{copy.notifications.createdAt}</span>
                    <span className="font-semibold text-white/70">
                      {formatTime(notification.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {canRespond && (
                    <>
                      <button
                        type="button"
                        onClick={() => onAccept(notification)}
                        disabled={action === 'accept'}
                        className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-100 disabled:opacity-50"
                      >
                        {copy.notifications.accept}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDecline(notification.id)}
                        disabled={action === 'decline'}
                        className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-black text-white/75 transition hover:bg-white/15 disabled:opacity-50"
                      >
                        {copy.notifications.decline}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => onArchive(notification.id)}
                    className="rounded-2xl bg-white/7 px-3 py-2 text-sm font-black text-white/55 transition hover:bg-white/12"
                  >
                    {copy.notifications.archive}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

type NotificationPreview = {
  avatarUrl?: string;
  subtitle?: string;
  title: string;
};

function PreviewAvatar({ preview }: { preview: NotificationPreview }) {
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-sm font-black text-slate-950">
      {preview.avatarUrl ? (
        <img
          src={preview.avatarUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        preview.title.slice(0, 1).toUpperCase()
      )}
    </div>
  );
}

function notificationPreview(
  notification: NotificationResource,
  context: {
    communities: Community[];
    communityAvatarUrls: Record<string, string>;
    communityPreviews: Record<string, Community>;
    conversations: ConversationResource[];
    identityNames: IdentityNames;
    identityPictures: IdentityPictures;
    identityProfiles: Record<string, IdentityResource>;
  },
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
  context: {
    identityNames: IdentityNames;
    identityPictures: IdentityPictures;
    identityProfiles: Record<string, IdentityResource>;
  },
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
