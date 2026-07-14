import type { ReactNode } from 'react';

import { PinIcon } from '../../../../contexts/messages/presentation/components/messageActionIcons';
import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { useTechnicalDetailsPreference } from '../../../../shared/presentation/preferences/useTechnicalDetailsPreference';

export function WorkspaceHeader({
  avatar,
  children,
  lock,
  menuContent,
  menuOpen,
  onMenuToggle,
  onOpenSidebar,
  onPinsOpen,
  onRealtimeEventsOpen,
  realtimeStatus,
  subtitle,
  title,
  titleAction,
}: {
  avatar: ReactNode;
  children?: ReactNode;
  lock?: ReactNode;
  menuContent?: ReactNode;
  menuOpen?: boolean;
  onMenuToggle?: () => void;
  onOpenSidebar: () => void;
  onPinsOpen?: () => void;
  onRealtimeEventsOpen?: () => void;
  realtimeStatus: 'connected' | 'reconnecting';
  subtitle: ReactNode;
  title: ReactNode;
  titleAction?: ReactNode;
}) {
  const [technicalDetailsVisible] = useTechnicalDetailsPreference();

  return (
    <header className="shrink-0 touch-pan-x border-b border-white/10 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          data-testid="workspace-sidebar-open-button"
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
        {technicalDetailsVisible ? (
          <RealtimeStatusButton
            onRealtimeEventsOpen={onRealtimeEventsOpen}
            realtimeStatus={realtimeStatus}
          />
        ) : null}
        {onPinsOpen ? <PinnedMessagesButton onPinsOpen={onPinsOpen} /> : null}
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

function PinnedMessagesButton({ onPinsOpen }: { onPinsOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onPinsOpen}
      className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl text-white/45 transition hover:bg-white/8 hover:text-white sm:grid"
      title={copy.messages.pinnedMessages}
      aria-label={copy.messages.pinnedMessages}
    >
      <PinIcon className="h-[1.125rem] w-[1.125rem]" />
    </button>
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
