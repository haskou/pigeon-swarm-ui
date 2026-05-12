import type { NotificationResource } from '../../domain/types';

import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { formatTime, shortId } from '../../utils/formatting';
import {
  identityDisplayName,
  type IdentityNames,
} from '../../utils/identityDisplay';

type NotificationAction = 'accept' | 'archive' | 'decline' | 'refresh';

interface NotificationsPanelProps {
  action: NotificationAction | null;
  error: string | null;
  notifications: NotificationResource[];
  identityNames: IdentityNames;
  onAccept: (notification: NotificationResource) => void;
  onArchive: (notificationId: string) => void;
  onClose: () => void;
  onDecline: (notificationId: string) => void;
}

export function NotificationsPanel({
  action,
  error,
  identityNames,
  notifications,
  onAccept,
  onArchive,
  onClose,
  onDecline,
}: NotificationsPanelProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-3 backdrop-blur-sm sm:p-5 lg:pointer-events-none lg:bg-transparent lg:backdrop-blur-none">
      <section className="glass-panel-strong ml-auto flex h-full w-full max-w-[430px] flex-col rounded-[2rem] p-4 shadow-2xl shadow-black/35 lg:pointer-events-auto lg:h-auto lg:max-h-[calc(100vh-2rem)]">
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
            <div className="rounded-3xl border border-white/10 bg-white/7 p-4 text-sm text-white/55">
              {copy.notifications.empty}
            </div>
          )}

          {notifications.map((notification) => (
            <article
              key={notification.id}
              className="rounded-3xl border border-white/10 bg-black/25 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-black text-white">
                    {copy.notifications.invitationTitle}
                  </h3>
                  <p className="mt-1 text-sm text-white/55">
                    {copy.notifications.invitedBy}{' '}
                    <span className="font-semibold text-white/75">
                      {identityDisplayName(
                        notification.payload.inviterIdentityId,
                        identityNames,
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
                <div className="flex items-center justify-between gap-3">
                  <span>{copy.notifications.conversation}</span>
                  <span className="truncate font-semibold text-white/70">
                    {shortId(notification.payload.conversationId)}
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
                {notification.state === 'pending' && (
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
          ))}
        </div>
      </section>
    </div>
  );
}
