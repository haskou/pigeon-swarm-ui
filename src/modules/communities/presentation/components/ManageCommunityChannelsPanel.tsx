import type {
  CommunityRoleResource,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { communityRoleDisplayName } from '../view-models/communityRoleDisplayName';
import type { ManagedCommunityChannel } from './ManagedCommunityChannels';
import { TrashIcon, VoiceIcon } from './communityDialogPrimitives';

type ManageCommunityChannelsPanelProps = {
  channelDrafts: Record<string, string>;
  channelName: string;
  channelOrder: ManagedCommunityChannel[];
  channelPermissionDrafts: Record<string, string[]>;
  channelType: 'text' | 'voice';
  onChannelCreate: () => void;
  onChannelDelete: (channel: ManagedCommunityChannel) => void;
  onChannelDraftChange: (channelId: string, value: string) => void;
  onChannelNameChange: (name: string) => void;
  onChannelTypeChange: (type: 'text' | 'voice') => void;
  onPendingChannelDeleteChange: (channelId: null | string) => void;
  onRoleToggle: (channelId: string, roleId: string) => void;
  onChannelMove: (channelId: string, direction: -1 | 1) => void;
  pendingChannelDeleteId: null | string;
  roles: CommunityRoleResource[];
  state: 'idle' | 'loading';
};

export function ManageCommunityChannelsPanel({
  channelDrafts,
  channelName,
  channelOrder,
  channelPermissionDrafts,
  channelType,
  onChannelCreate,
  onChannelDelete,
  onChannelDraftChange,
  onChannelMove,
  onChannelNameChange,
  onChannelTypeChange,
  onPendingChannelDeleteChange,
  onRoleToggle,
  pendingChannelDeleteId,
  roles,
  state,
}: ManageCommunityChannelsPanelProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/35">
        {copy.communities.channels}
      </div>
      <div className="max-h-[34vh] space-y-3 overflow-y-auto pr-1 sm:max-h-[48vh]">
        {channelOrder.map((channel, index) => (
          <ChannelDraftCard
            channel={channel}
            channelDrafts={channelDrafts}
            channelOrder={channelOrder}
            channelPermissionDrafts={channelPermissionDrafts}
            index={index}
            key={channel.id}
            onChannelDelete={onChannelDelete}
            onChannelDraftChange={onChannelDraftChange}
            onChannelMove={onChannelMove}
            onPendingChannelDeleteChange={onPendingChannelDeleteChange}
            onRoleToggle={onRoleToggle}
            pendingChannelDeleteId={pendingChannelDeleteId}
            roles={roles}
            state={state}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-black/20 p-1">
        {(['text', 'voice'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChannelTypeChange(type)}
            className={cx(
              'rounded-2xl px-3 py-2 text-xs font-black transition',
              channelType === type
                ? 'bg-white text-slate-950'
                : 'text-white/55 hover:bg-white/10',
            )}
          >
            {type === 'voice'
              ? copy.communities.voiceChannel
              : copy.communities.textChannel}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={channelName}
          onChange={(event) => onChannelNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            onChannelCreate();
          }}
          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
          placeholder={copy.communities.addChannelPlaceholder}
        />
        <button
          type="button"
          onClick={onChannelCreate}
          disabled={!channelName.trim() || state === 'loading'}
          className="grid h-11 w-12 shrink-0 place-items-center rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
          aria-label={copy.communities.addInitialChannel}
        >
          +
        </button>
      </div>
    </div>
  );
}

function ChannelDraftCard({
  channel,
  channelDrafts,
  channelOrder,
  channelPermissionDrafts,
  index,
  onChannelDelete,
  onChannelDraftChange,
  onChannelMove,
  onPendingChannelDeleteChange,
  onRoleToggle,
  pendingChannelDeleteId,
  roles,
  state,
}: {
  channel: ManagedCommunityChannel;
  channelDrafts: Record<string, string>;
  channelOrder: ManagedCommunityChannel[];
  channelPermissionDrafts: Record<string, string[]>;
  index: number;
  onChannelDelete: (channel: ManagedCommunityChannel) => void;
  onChannelDraftChange: (channelId: string, value: string) => void;
  onChannelMove: (channelId: string, direction: -1 | 1) => void;
  onPendingChannelDeleteChange: (channelId: null | string) => void;
  onRoleToggle: (channelId: string, roleId: string) => void;
  pendingChannelDeleteId: null | string;
  roles: CommunityRoleResource[];
  state: 'idle' | 'loading';
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-3">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-white/65">
          {channel.type === 'voice' ? <VoiceIcon /> : '#'}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={channelDrafts[channel.id] ?? channel.name}
            onChange={(event) =>
              onChannelDraftChange(channel.id, event.target.value)
            }
            className="h-10 w-full min-w-0 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm font-bold text-white outline-none focus:border-cyan-300/60"
          />
          <ChannelDraftActions
            channel={channel}
            channelOrder={channelOrder}
            index={index}
            onChannelMove={onChannelMove}
            onPendingChannelDeleteChange={onPendingChannelDeleteChange}
            state={state}
          />
        </div>
      </div>
      <ChannelVisibilityRoles
        channel={channel}
        channelPermissionDrafts={channelPermissionDrafts}
        onRoleToggle={onRoleToggle}
        roles={roles}
      />
      {pendingChannelDeleteId === channel.id && (
        <ChannelDeleteConfirmation
          channel={channel}
          onChannelDelete={onChannelDelete}
          onPendingChannelDeleteChange={onPendingChannelDeleteChange}
          state={state}
        />
      )}
    </div>
  );
}

function ChannelDraftActions({
  channel,
  channelOrder,
  index,
  onChannelMove,
  onPendingChannelDeleteChange,
  state,
}: {
  channel: ManagedCommunityChannel;
  channelOrder: ManagedCommunityChannel[];
  index: number;
  onChannelMove: (channelId: string, direction: -1 | 1) => void;
  onPendingChannelDeleteChange: (channelId: null | string) => void;
  state: 'idle' | 'loading';
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-black/25 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/40">
        {channel.type === 'voice'
          ? copy.communities.voiceChannel
          : copy.communities.textChannel}
      </span>
      <button
        type="button"
        onClick={() => onChannelMove(channel.id, -1)}
        disabled={index === 0}
        className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 font-black transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
        aria-label={copy.communities.moveChannelUp}
        title={copy.communities.moveChannelUp}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => onChannelMove(channel.id, 1)}
        disabled={index === channelOrder.length - 1}
        className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 font-black transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
        aria-label={copy.communities.moveChannelDown}
        title={copy.communities.moveChannelDown}
      >
        ↓
      </button>
      <button
        type="button"
        onClick={() => onPendingChannelDeleteChange(channel.id)}
        disabled={state === 'loading'}
        className="grid h-9 w-9 place-items-center rounded-xl bg-rose-500/15 text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-35"
        aria-label={copy.communities.deleteChannel}
        title={copy.communities.deleteChannel}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function ChannelVisibilityRoles({
  channel,
  channelPermissionDrafts,
  onRoleToggle,
  roles,
}: {
  channel: ManagedCommunityChannel;
  channelPermissionDrafts: Record<string, string[]>;
  onRoleToggle: (channelId: string, roleId: string) => void;
  roles: CommunityRoleResource[];
}) {
  const channelRoleIds = channelPermissionDrafts[channel.id] ?? ['everyone'];

  return (
    <div className="mt-3 rounded-2xl bg-black/20 p-3">
      <div className="mb-2 text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/35">
        {copy.communities.visibleRoles}
      </div>
      <div className="flex flex-wrap gap-2">
        {roles
          .filter((role) => role.id === 'everyone')
          .map((role) => (
            <RoleVisibilityOption
              key={`${channel.id}:${role.id}`}
              label={copy.communities.visibleToEveryone}
              onToggle={() => onRoleToggle(channel.id, role.id)}
              selected={channelRoleIds.includes(role.id)}
            />
          ))}
        {roles.some((role) => role.id !== 'everyone') && (
          <div className="mt-1 w-full border-t border-white/10 pt-3">
            <div className="mb-2 text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/35">
              {copy.communities.visibleToSelectedRoles}
            </div>
            <div className="flex flex-wrap gap-2">
              {roles
                .filter((role) => role.id !== 'everyone')
                .map((role) => (
                  <RoleVisibilityOption
                    key={`${channel.id}:${role.id}`}
                    label={communityRoleDisplayName(role)}
                    onToggle={() => onRoleToggle(channel.id, role.id)}
                    selected={channelRoleIds.includes(role.id)}
                  />
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleVisibilityOption({
  label,
  onToggle,
  selected,
}: {
  label: string;
  onToggle: () => void;
  selected: boolean;
}) {
  return (
    <label
      className={cx(
        'inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition',
        selected
          ? 'border-cyan-200/70 bg-cyan-200 text-slate-950'
          : 'border-white/10 bg-white/8 text-white/70 hover:bg-white/12 hover:text-white',
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cx(
          'grid h-4 w-4 place-items-center rounded border text-[0.6rem]',
          selected
            ? 'border-slate-950 bg-slate-950 text-white'
            : 'border-white/35',
        )}
      >
        {selected ? '✓' : ''}
      </span>
      {label}
    </label>
  );
}

function ChannelDeleteConfirmation({
  channel,
  onChannelDelete,
  onPendingChannelDeleteChange,
  state,
}: {
  channel: ManagedCommunityChannel;
  onChannelDelete: (channel: ManagedCommunityChannel) => void;
  onPendingChannelDeleteChange: (channelId: null | string) => void;
  state: 'idle' | 'loading';
}) {
  return (
    <div className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-3">
      <div className="text-xs font-bold text-rose-50/85">
        {copy.communities.deleteChannelConfirm}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChannelDelete(channel)}
          disabled={state === 'loading'}
          className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-black text-rose-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {copy.communities.confirmDeleteChannel}
        </button>
        <button
          type="button"
          onClick={() => onPendingChannelDeleteChange(null)}
          className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/15"
        >
          {copy.dialog.cancel}
        </button>
      </div>
    </div>
  );
}
