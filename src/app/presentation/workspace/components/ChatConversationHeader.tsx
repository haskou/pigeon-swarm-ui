/* eslint-disable @typescript-eslint/no-use-before-define */
import type { MouseEvent, ReactNode } from 'react';

import type {
  ConversationResource,
  IdentityPresence,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { FallbackImage } from '../../../../shared/presentation/components/FallbackImage';
import { PresenceStatusDot } from '../../../../contexts/identities/presentation/components/presenceStatusDot';
import { LockIcon } from './LockIcon';
import { WorkspaceHeader } from './WorkspaceHeader';

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
  onPinsOpen?: () => void;
  onRealtimeEventsOpen?: () => void;
  peerPicture?: string;
  peerPresence?: IdentityPresence;
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
  onPinsOpen,
  onRealtimeEventsOpen,
  peerPicture,
  peerPresence,
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
    <WorkspaceHeader
      avatar={
        <button
          type="button"
          onClick={onConversationOpen}
          disabled={!canOpenConversation}
          className="relative grid h-12 w-12 shrink-0 place-items-center overflow-visible rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950 disabled:cursor-default"
          aria-label={activeConversationName ?? copy.chat.noConversation}
        >
          <span className="absolute inset-0 grid place-items-center overflow-hidden rounded-2xl">
            <ConversationAvatar
              activeConversation={activeConversation}
              activeConversationName={activeConversationName}
              peerPicture={peerPicture}
            />
          </span>
          {!isGroupConversation && activeConversation && (
            <PresenceStatusDot
              presence={peerPresence}
              size="lg"
              className="-bottom-1 -right-1"
            />
          )}
        </button>
      }
      lock={
        activeConversation ? (
          <ConversationLockState
            hasConversationKey={hasConversationKey}
            tooltip={e2eTooltip}
          />
        ) : null
      }
      menuContent={children}
      menuOpen={menuOpen}
      onMenuToggle={activeConversation ? onMenuToggle : undefined}
      onOpenSidebar={onOpenSidebar}
      onPinsOpen={activeConversation ? onPinsOpen : undefined}
      onRealtimeEventsOpen={onRealtimeEventsOpen}
      realtimeStatus={realtimeStatus}
      subtitle={
        activeConversation ? (
          <ConversationMetadata
            conversationNetworkName={conversationNetworkName}
            conversationNetworkTooltip={conversationNetworkTooltip}
            isGroupConversation={isGroupConversation}
          />
        ) : (
          <div className="truncate text-sm text-white/50">
            {copy.chat.noConversationHint}
          </div>
        )
      }
      title={
        activeConversation
          ? (activeConversationTitle ?? activeConversation.id)
          : copy.chat.noConversation
      }
      titleAction={
        <button
          type="button"
          onClick={onConversationOpen}
          disabled={!canOpenConversation}
          className="min-w-0 truncate text-left text-xl font-black tracking-tight disabled:cursor-default sm:text-2xl"
        >
          {activeConversation
            ? (activeConversationTitle ?? activeConversation.id)
            : copy.chat.noConversation}
        </button>
      }
    />
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
  if (!activeConversation) return '∅';

  const fallback = (activeConversationName ?? activeConversation.id)
    .slice(0, 1)
    .toUpperCase();

  return (
    <FallbackImage
      src={peerPicture}
      alt=""
      className="h-full w-full object-cover"
      fallback={fallback}
    />
  );
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
          ? 'inline-grid h-5 w-5 shrink-0 place-items-center text-emerald-300'
          : 'inline-grid h-5 w-5 shrink-0 place-items-center text-rose-300'
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
    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-white/50 sm:text-sm">
      <span className="shrink-0">
        <span className="sm:hidden">
          {isGroupConversation
            ? copy.dialog.groupConversation
            : copy.dialog.directConversation}
        </span>
        <span className="hidden sm:inline">{modeLabel}</span>
      </span>
      <span className="text-white/25">·</span>
      <span
        className="min-w-0 max-w-full truncate"
        title={conversationNetworkTooltip}
      >
        {conversationNetworkName}
      </span>
    </div>
  );
}

function canOpenActiveConversation(
  activeConversation: ConversationResource | undefined,
  isGroupConversation: boolean,
  canOpenPeerProfile: boolean,
): boolean {
  return !!activeConversation && (isGroupConversation || canOpenPeerProfile);
}
