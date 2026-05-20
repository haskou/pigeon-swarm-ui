import type { NotificationResource } from '../../../../domain/types';

import { copy } from '../../../../i18n/en';
import { cx } from '../../../../utils/classNameHelper';
import { formatTime, shortId } from '../../../../utils/formatting';
import { identityDisplayName } from '../../../../utils/identityDisplay';
import { notificationPreview } from '../view-models/panelNotificationPreview';
import type {
  NotificationPreview,
  NotificationPreviewContext,
} from '../view-models/panelNotificationPreview.types';

import type { NotificationAction } from './notificationAction';

interface NotificationCardProps {
  action: NotificationAction | null;
  notification: NotificationResource;
  onAccept: (notification: NotificationResource) => void;
  onArchive: (notificationId: string) => void;
  onDecline: (notificationId: string) => void;
  previewContext: NotificationPreviewContext;
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

export function NotificationCard({
  action,
  notification,
  onAccept,
  onArchive,
  onDecline,
  previewContext,
}: NotificationCardProps) {
  const target = notificationTarget(notification);
  const preview = notificationPreview(notification, previewContext);
  const inviterIdentityId =
    notification.type === 'missed_call'
      ? notification.payload.callerIdentityId
      : notification.payload.inviterIdentityId;
  const canRespond =
    notification.state === 'pending' && notification.type !== 'missed_call';

  return (
    <article className="rounded-2xl border border-white/10 bg-black/25 p-4">
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
              {identityDisplayName(
                inviterIdentityId,
                previewContext.identityNames,
              )}
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
}
