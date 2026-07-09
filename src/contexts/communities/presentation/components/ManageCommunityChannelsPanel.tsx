import type { CommunityRoleResource } from '../../../../shared/domain/pigeonResources.types';

import { useEffect, useMemo, useState } from 'react';

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
  canSave: boolean;
  onChannelCreate: () => void;
  onChannelDelete: (channel: ManagedCommunityChannel) => void;
  onChannelDraftChange: (channelId: string, value: string) => void;
  onChannelNameChange: (name: string) => void;
  onChannelTypeChange: (type: 'text' | 'voice') => void;
  onPendingChannelDeleteChange: (channelId: null | string) => void;
  onRoleToggle: (channelId: string, roleId: string) => void;
  onSave: () => void;
  onChannelMove: (channelId: string, direction: -1 | 1) => void;
  pendingChannelDeleteId: null | string;
  roles: CommunityRoleResource[];
  saveLabel: string;
  state: 'idle' | 'loading';
};

export function ManageCommunityChannelsPanel({
  channelDrafts,
  channelName,
  channelOrder,
  channelPermissionDrafts,
  channelType,
  canSave,
  onChannelCreate,
  onChannelDelete,
  onChannelDraftChange,
  onChannelMove,
  onChannelNameChange,
  onChannelTypeChange,
  onPendingChannelDeleteChange,
  onRoleToggle,
  onSave,
  pendingChannelDeleteId,
  roles,
  saveLabel,
  state,
}: ManageCommunityChannelsPanelProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    channelOrder[0]?.id ?? null,
  );
  const selectedChannel = useMemo(
    () =>
      channelOrder.find((channel) => channel.id === selectedChannelId) ?? null,
    [channelOrder, selectedChannelId],
  );

  useEffect(() => {
    if (selectedChannel) return;

    setSelectedChannelId(channelOrder[0]?.id ?? null);
  }, [channelOrder, selectedChannel]);

  return (
    <div>
      <div className="ui-section-heading pt-0">{copy.communities.channels}</div>
      <div className="grid min-h-0 gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="min-h-0 border-y border-white/10 py-2">
          <div className="max-h-[34vh] space-y-1 overflow-y-auto pr-1 sm:max-h-[46vh]">
            {channelOrder.map((channel) => (
              <ChannelListButton
                active={channel.id === selectedChannelId}
                channel={channel}
                channelDrafts={channelDrafts}
                key={channel.id}
                onSelect={() => setSelectedChannelId(channel.id)}
              />
            ))}
          </div>
          <ChannelCreateRow
            channelName={channelName}
            channelType={channelType}
            disabled={state === 'loading'}
            onChannelCreate={onChannelCreate}
            onChannelNameChange={onChannelNameChange}
            onChannelTypeChange={onChannelTypeChange}
          />
        </div>
        {selectedChannel ? (
          <ChannelEditorPanel
            canSave={canSave}
            channel={selectedChannel}
            channelDrafts={channelDrafts}
            channelOrder={channelOrder}
            channelPermissionDrafts={channelPermissionDrafts}
            onChannelDelete={onChannelDelete}
            onChannelDraftChange={onChannelDraftChange}
            onChannelMove={onChannelMove}
            onPendingChannelDeleteChange={onPendingChannelDeleteChange}
            onRoleToggle={onRoleToggle}
            onSave={onSave}
            pendingChannelDeleteId={pendingChannelDeleteId}
            roles={roles}
            saveLabel={saveLabel}
            state={state}
          />
        ) : (
          <div className="grid gap-3 border-y border-white/10 py-4 text-sm font-semibold text-white/45">
            <span>{copy.communities.noChannels}</span>
            {canSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={state === 'loading'}
                className="ui-button ui-button-primary justify-self-start"
              >
                {saveLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelCreateRow({
  channelName,
  channelType,
  disabled,
  onChannelCreate,
  onChannelNameChange,
  onChannelTypeChange,
}: {
  channelName: string;
  channelType: 'text' | 'voice';
  disabled: boolean;
  onChannelCreate: () => void;
  onChannelNameChange: (name: string) => void;
  onChannelTypeChange: (type: 'text' | 'voice') => void;
}) {
  return (
    <div className="mt-2 flex gap-2">
      <input
        value={channelName}
        onChange={(event) => onChannelNameChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          onChannelCreate();
        }}
        className="ui-field-control h-10 min-w-0 flex-1 px-3 py-2 text-sm placeholder:text-white/30"
        placeholder={copy.communities.addChannelPlaceholder}
      />
      <select
        value={channelType}
        onChange={(event) =>
          onChannelTypeChange(event.target.value as 'text' | 'voice')
        }
        className="ui-field-control h-10 w-24 shrink-0 px-2 text-xs font-bold"
        aria-label={copy.communities.channelType}
      >
        {(['text', 'voice'] as const).map((type) => (
          <option key={type} value={type}>
            {type === 'voice'
              ? copy.communities.voiceChannel
              : copy.communities.textChannel}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onChannelCreate}
        disabled={!channelName.trim() || disabled}
        className="ui-button ui-button-primary h-10 w-10 shrink-0 p-0"
        aria-label={copy.communities.addInitialChannel}
      >
        +
      </button>
    </div>
  );
}

function ChannelListButton({
  active,
  channel,
  channelDrafts,
  onSelect,
}: {
  active: boolean;
  channel: ManagedCommunityChannel;
  channelDrafts: Record<string, string>;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(
        'flex w-full items-center gap-2 rounded-md border-l-2 px-3 py-2 text-left text-sm font-bold transition',
        active
          ? 'border-cyan-300/80 bg-cyan-300/10 text-cyan-50'
          : 'border-transparent text-white/65 hover:bg-white/[0.06] hover:text-white',
      )}
    >
      <span className="grid w-5 shrink-0 place-items-center text-current/80">
        {channel.type === 'voice' ? <VoiceIcon /> : '#'}
      </span>
      <span className="min-w-0 flex-1 truncate">
        {channelDrafts[channel.id] ?? channel.name}
      </span>
    </button>
  );
}

function ChannelEditorPanel({
  canSave,
  channel,
  channelDrafts,
  channelOrder,
  channelPermissionDrafts,
  onChannelDelete,
  onChannelDraftChange,
  onChannelMove,
  onPendingChannelDeleteChange,
  onRoleToggle,
  onSave,
  pendingChannelDeleteId,
  roles,
  saveLabel,
  state,
}: {
  canSave: boolean;
  channel: ManagedCommunityChannel;
  channelDrafts: Record<string, string>;
  channelOrder: ManagedCommunityChannel[];
  channelPermissionDrafts: Record<string, string[]>;
  onChannelDelete: (channel: ManagedCommunityChannel) => void;
  onChannelDraftChange: (channelId: string, value: string) => void;
  onChannelMove: (channelId: string, direction: -1 | 1) => void;
  onPendingChannelDeleteChange: (channelId: null | string) => void;
  onRoleToggle: (channelId: string, roleId: string) => void;
  onSave: () => void;
  pendingChannelDeleteId: null | string;
  roles: CommunityRoleResource[];
  saveLabel: string;
  state: 'idle' | 'loading';
}) {
  const index = channelOrder.findIndex(
    (candidate) => candidate.id === channel.id,
  );

  return (
    <div className="ui-list-block">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <label className="mb-1 block text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/35">
            {copy.communities.name}
          </label>
          <input
            value={channelDrafts[channel.id] ?? channel.name}
            onChange={(event) =>
              onChannelDraftChange(channel.id, event.target.value)
            }
            className="ui-field-control h-10 min-w-0 px-3 py-2 text-sm font-semibold"
          />
        </div>
        <div>
          <div className="mb-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/35">
            {copy.communities.channelType}
          </div>
          <span className="inline-flex h-10 items-center gap-2 border-b border-white/10 px-1 text-xs font-semibold text-white/65">
            {channel.type === 'voice' ? <VoiceIcon /> : '#'}
            {channel.type === 'voice'
              ? copy.communities.voiceChannel
              : copy.communities.textChannel}
          </span>
        </div>
      </div>
      <ChannelVisibilityRoles
        channel={channel}
        channelPermissionDrafts={channelPermissionDrafts}
        onRoleToggle={onRoleToggle}
        roles={roles}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ChannelDraftActions
          channel={channel}
          channelOrder={channelOrder}
          index={index}
          onChannelMove={onChannelMove}
          onPendingChannelDeleteChange={onPendingChannelDeleteChange}
          state={state}
        />
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || state === 'loading'}
          className="ui-button ui-button-primary ml-auto"
        >
          {saveLabel}
        </button>
      </div>
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
      <button
        type="button"
        onClick={() => onChannelMove(channel.id, -1)}
        disabled={index === 0}
        className="ui-icon-button h-9 w-9 font-black disabled:cursor-not-allowed disabled:opacity-35"
        aria-label={copy.communities.moveChannelUp}
        title={copy.communities.moveChannelUp}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => onChannelMove(channel.id, 1)}
        disabled={index === channelOrder.length - 1}
        className="ui-icon-button h-9 w-9 font-black disabled:cursor-not-allowed disabled:opacity-35"
        aria-label={copy.communities.moveChannelDown}
        title={copy.communities.moveChannelDown}
      >
        ↓
      </button>
      <button
        type="button"
        onClick={() => onPendingChannelDeleteChange(channel.id)}
        disabled={state === 'loading'}
        className="ui-icon-button h-9 w-9 border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-35"
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
    <div className="mt-3 border-t border-white/10 pt-3">
      <div className="mb-2 text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/35">
        {copy.communities.visibleRoles}
      </div>
      <div className="grid gap-1">
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
          <div className="mt-2 w-full border-t border-white/10 pt-3">
            <div className="mb-2 text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/35">
              {copy.communities.visibleToSelectedRoles}
            </div>
            <div className="grid gap-1">
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
        'flex w-full cursor-pointer items-center gap-3 border-l-2 px-3 py-2.5 text-sm font-semibold transition',
        selected
          ? 'border-l-cyan-300/80 bg-cyan-300/10 text-cyan-50'
          : 'border-l-transparent text-white/65 hover:bg-white/[0.06] hover:text-white',
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
    <div className="ui-inline-notice mt-3 border-rose-300/40 bg-rose-500/10">
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
