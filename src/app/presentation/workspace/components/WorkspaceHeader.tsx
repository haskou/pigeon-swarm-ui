import type { ReactNode } from 'react';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';

export function WorkspaceHeader({
  avatar,
  children,
  menuContent,
  menuOpen,
  onMenuToggle,
  onOpenSidebar,
  onRealtimeEventsOpen,
  realtimeStatus,
  title,
  titleAction,
  lock,
  subtitle,
}: {
  avatar: ReactNode;
  children?: ReactNode;
  lock?: ReactNode;
  menuContent?: ReactNode;
  menuOpen?: boolean;
  onMenuToggle?: () => void;
  onOpenSidebar: () => void;
  onRealtimeEventsOpen?: () => void;
  realtimeStatus: 'connected' | 'reconnecting';
  subtitle: ReactNode;
  title: ReactNode;
  titleAction?: ReactNode;
}) {
  return (
    <header className="shrink-0 touch-pan-x border-b border-white/10 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label={copy.chat.menu}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 font-black text-white lg:hidden"
        >
          ☰
        </button>
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {titleAction ?? (
              <h1 className="truncate text-2xl font-black tracking-tight">
                {title}
              </h1>
            )}
            {lock}
          </div>
          {subtitle}
        </div>
        <RealtimeStatusButton
          onRealtimeEventsOpen={onRealtimeEventsOpen}
          realtimeStatus={realtimeStatus}
        />
        {onMenuToggle && (
          <div className="relative ml-auto flex shrink-0 items-center gap-1">
            {children}
            <button
              type="button"
              onClick={onMenuToggle}
              className="grid h-11 w-11 place-items-center rounded-2xl text-xl font-black text-white/70 transition hover:bg-white/15"
              aria-label={copy.chat.conversationMenu}
              aria-expanded={menuOpen}
            >
              ⋮
            </button>
            {menuContent}
          </div>
        )}
      </div>
    </header>
  );
}

function RealtimeStatusButton({
  onRealtimeEventsOpen,
  realtimeStatus,
}: {
  onRealtimeEventsOpen?: () => void;
  realtimeStatus: 'connected' | 'reconnecting';
}) {
  const connected = realtimeStatus === 'connected';
  const label = connected
    ? copy.chat.realtimeConnected
    : copy.chat.realtimeReconnecting;

  return (
    <button
      type="button"
      onClick={onRealtimeEventsOpen}
      className={cx(
        'hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black transition sm:flex',
        connected
          ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15'
          : 'border-amber-300/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15',
      )}
      title={label}
    >
      <span
        className={cx(
          'h-2 w-2 rounded-full',
          connected ? 'bg-emerald-300' : 'bg-amber-300',
        )}
      />
      {label}
    </button>
  );
}
