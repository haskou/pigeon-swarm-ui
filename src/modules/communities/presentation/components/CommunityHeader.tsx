import type { ReactNode } from 'react';

import type {
  Community,
  CommunityTextChannel,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { FallbackImage } from '../../../../shared/presentation/components/FallbackImage';
import { WorkspaceHeader } from '../../../../app/presentation/workspace/components/WorkspaceHeader';
import { LockIcon } from '../../../../app/presentation/workspace/components/LockIcon';

export function CommunityHeader({
  avatarUrl,
  channelEncryptionReady,
  channelPublic,
  channelEncryptionTooltip,
  children,
  community,
  communityLeaveError,
  communityMenuOpen,
  menuContent,
  networkName,
  onCommunityMenuToggle,
  onOpenAvatar,
  onOpenMobileSidebar,
  onPinsOpen,
  onRealtimeEventsOpen,
  realtimeStatus,
  selectedChannel,
}: {
  avatarUrl: null | string;
  channelEncryptionReady: boolean;
  channelPublic?: boolean;
  channelEncryptionTooltip: string;
  children?: ReactNode;
  community: Community;
  communityLeaveError?: null | string;
  communityMenuOpen: boolean;
  menuContent?: ReactNode;
  networkName: string;
  onCommunityMenuToggle: () => void;
  onOpenAvatar?: () => void;
  onOpenMobileSidebar: () => void;
  onPinsOpen?: () => void;
  onRealtimeEventsOpen?: () => void;
  realtimeStatus: 'connected' | 'reconnecting';
  selectedChannel?: CommunityTextChannel;
}) {
  const title = selectedChannel ? `# ${selectedChannel.name}` : community.name;
  const subtitle = selectedChannel ? (
    <p className="truncate text-sm text-white/50">
      <span className="lg:hidden">{community.name}</span>
      <span className="hidden lg:inline">
        {copy.communities.channelMetadataOnly}{' '}
        <span title={community.networkId}>{networkName}</span>
      </span>
    </p>
  ) : (
    <p className="truncate text-sm text-white/50">{community.description}</p>
  );

  return (
    <WorkspaceHeader
      avatar={
        <button
          type="button"
          onClick={onOpenAvatar}
          disabled={!onOpenAvatar}
          className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950 transition enabled:hover:brightness-110 disabled:cursor-default"
          aria-label={copy.communities.openAvatar}
        >
          <FallbackImage
            src={avatarUrl}
            alt=""
            className="h-full w-full object-cover"
            fallback={community.name.slice(0, 1).toUpperCase()}
          />
        </button>
      }
      lock={
        <span
          className={cx(
            'shrink-0',
            channelPublic
              ? 'text-amber-300'
              : channelEncryptionReady
                ? 'text-emerald-300'
                : 'text-rose-300',
          )}
          title={channelEncryptionTooltip}
          aria-label={channelEncryptionTooltip}
        >
          <LockIcon locked={!channelPublic && channelEncryptionReady} />
        </span>
      }
      menuContent={
        <>
          {communityLeaveError ? (
            <div className="absolute bottom-[calc(100%+.5rem)] right-0 z-40 w-72 rounded-2xl border border-rose-300/20 bg-rose-500/15 p-3 text-xs font-black text-rose-100 shadow-2xl shadow-black/40">
              {communityLeaveError}
            </div>
          ) : null}
          {menuContent}
        </>
      }
      menuOpen={communityMenuOpen}
      onMenuToggle={onCommunityMenuToggle}
      onOpenSidebar={onOpenMobileSidebar}
      onPinsOpen={selectedChannel ? onPinsOpen : undefined}
      onRealtimeEventsOpen={onRealtimeEventsOpen}
      realtimeStatus={realtimeStatus}
      subtitle={subtitle}
      title={title}
    >
      {children}
    </WorkspaceHeader>
  );
}
