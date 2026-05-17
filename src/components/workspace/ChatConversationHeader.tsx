/* eslint-disable @typescript-eslint/no-use-before-define */
import type { MouseEvent, ReactNode } from 'react';

import type { ConversationResource } from '../../domain/types';

import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { LockIcon } from './LockIcon';

interface ChatConversationHeaderProps {
  activeConversation?: ConversationResource;
  activeConversationName?: string;
  activeConversationTitle?: string;
  canOpenPeerProfile: boolean;
  children?: ReactNode;
  conversationNetworkName: string;
  conversationNetworkTooltip: string;
  hasConversationKey: boolean;
  isGroupConversation: boolean;
  onConversationOpen: (event?: MouseEvent<HTMLElement>) => void;
  onMenuToggle: () => void;
  onOpenSidebar: () => void;
  onRealtimeEventsOpen?: () => void;
  peerPicture?: string;
  menuOpen: boolean;
  realtimeStatus: 'connected' | 'reconnecting';
}

export function ChatConversationHeader({
  activeConversation,
  activeConversationName,
  activeConversationTitle,
  canOpenPeerProfile,
  children,
  conversationNetworkName,
  conversationNetworkTooltip,
  hasConversationKey,
  isGroupConversation,
  menuOpen,
  onConversationOpen,
  onMenuToggle,
  onOpenSidebar,
  onRealtimeEventsOpen,
  peerPicture,
  realtimeStatus,
}: ChatConversationHeaderProps) {
  const e2eTooltip = hasConversationKey
    ? copy.chat.e2eReady
    : copy.chat.e2eMissing;
  const canOpenConversation = canOpenActiveConversation(
    activeConversation,
    isGroupConversation,
    canOpenPeerProfile,
  );

  return (
    <header className="shrink-0 touch-pan-x border-b border-white/10 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          aria-label={copy.chat.menu}
          className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 font-black lg:hidden"
        >
          ☰
        </button>
        <button
          type="button"
          onClick={onConversationOpen}
          disabled={!canOpenConversation}
          className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950 disabled:cursor-default"
          aria-label={activeConversationName ?? copy.chat.noConversation}
        >
          <ConversationAvatar
            activeConversation={activeConversation}
            activeConversationName={activeConversationName}
            peerPicture={peerPicture}
          />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onConversationOpen}
              disabled={!canOpenConversation}
              className="min-w-0 truncate text-left text-2xl font-black tracking-tight disabled:cursor-default"
            >
              {activeConversation
                ? (activeConversationTitle ?? activeConversation.id)
                : copy.chat.noConversation}
            </button>
            {activeConversation ? (
              <ConversationLockState
                hasConversationKey={hasConversationKey}
                tooltip={e2eTooltip}
              />
            ) : null}
          </div>
          {activeConversation ? (
            <ConversationMetadata
              conversationNetworkName={conversationNetworkName}
              conversationNetworkTooltip={conversationNetworkTooltip}
              isGroupConversation={isGroupConversation}
            />
          ) : (
            <div className="truncate text-sm text-white/50">
              {copy.chat.noConversationHint}
            </div>
          )}
        </div>
        <RealtimeStatusButton
          onRealtimeEventsOpen={onRealtimeEventsOpen}
          realtimeStatus={realtimeStatus}
        />
        {activeConversation ? (
          <div className="relative ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onMenuToggle}
              className="grid h-11 w-11 place-items-center rounded-2xl text-xl font-black text-white/70 transition hover:bg-white/15"
              aria-label={copy.chat.conversationMenu}
              aria-expanded={menuOpen}
            >
              ⋮
            </button>
            {children}
          </div>
        ) : null}
      </div>
    </header>
  );
}

function ConversationAvatar({
  activeConversation,
  activeConversationName,
  peerPicture,
}: {
  activeConversation?: ConversationResource;
  activeConversationName?: string;
  peerPicture?: string;
}) {
  if (peerPicture) {
    return (
      <img src={peerPicture} alt="" className="h-full w-full object-cover" />
    );
  }

  if (!activeConversation) return '∅';

  return (activeConversationName ?? activeConversation.id)
    .slice(0, 1)
    .toUpperCase();
}

function ConversationLockState({
  hasConversationKey,
  tooltip,
}: {
  hasConversationKey: boolean;
  tooltip: string;
}) {
  return (
    <span
      className={
        hasConversationKey
          ? 'shrink-0 text-emerald-300'
          : 'shrink-0 text-rose-300'
      }
      title={tooltip}
      aria-label={tooltip}
    >
      <LockIcon locked={hasConversationKey} />
    </span>
  );
}

function ConversationMetadata({
  conversationNetworkName,
  conversationNetworkTooltip,
  isGroupConversation,
}: {
  conversationNetworkName: string;
  conversationNetworkTooltip: string;
  isGroupConversation: boolean;
}) {
  const modeLabel = isGroupConversation
    ? copy.chat.groupMessage
    : copy.chat.directMessage;

  return (
    <div className="mt-1 flex min-w-0 items-center gap-2 text-sm text-white/50">
      <span className="shrink-0">{modeLabel}</span>
      <span className="text-white/25">·</span>
      <span className="min-w-0 truncate" title={conversationNetworkTooltip}>
        {conversationNetworkName}
      </span>
    </div>
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

function canOpenActiveConversation(
  activeConversation: ConversationResource | undefined,
  isGroupConversation: boolean,
  canOpenPeerProfile: boolean,
): boolean {
  return !!activeConversation && (isGroupConversation || canOpenPeerProfile);
}
