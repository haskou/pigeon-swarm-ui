import { useState, type MouseEvent } from 'react';

import type {
  CommunityChannelThreadSummary,
  CommunityTextChannel,
  CommunityVoiceChannel,
  NotificationScopeSetting,
} from '../../../../shared/domain/pigeonResources.types';

import { NotificationSettingsPolicy } from '../../../notifications/domain/NotificationSettingsPolicy';
import { notificationSettingSummary } from '../../../notifications/presentation/view-models/notificationSettingSummary';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { shortId } from '../../../../shared/presentation/formatting';
import { ClearableSearchInput } from '../../../../shared/presentation/components/ClearableSearchInput';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import {
  VoiceChannelButton,
  type VoiceParticipantView,
} from './VoiceParticipantView';

export function CommunityChannelList({
  activeVoiceChannelId,
  channelSearch,
  channelUnreadCounts,
  onChannelSearchChange,
  onTextChannelSelected,
  onThreadSelected,
  onTextChannelNotificationSettingsOpen,
  onTextChannelMuteToggle,
  onVoiceChannelJoin,
  onVoiceParticipantClick,
  selectedChannelId,
  selectedThreadRootMessageId,
  threadLabelByRootMessageId,
  textChannels,
  textChannelNotificationSetting,
  visibleTextChannels,
  visibleVoiceChannels,
  voiceChannels,
  voiceParticipantsByChannelId,
}: {
  activeVoiceChannelId: null | string;
  channelSearch: string;
  channelUnreadCounts: Record<string, number>;
  onChannelSearchChange: (value: string) => void;
  onTextChannelSelected: (channelId: string) => void;
  onThreadSelected: (
    channel: CommunityTextChannel,
    thread: CommunityChannelThreadSummary,
  ) => void;
  onTextChannelNotificationSettingsOpen: (channel: CommunityTextChannel) => void;
  onTextChannelMuteToggle: (channel: CommunityTextChannel) => void;
  onVoiceChannelJoin: (channel: CommunityVoiceChannel) => void;
  onVoiceParticipantClick: (
    participant: VoiceParticipantView,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  selectedChannelId: null | string;
  selectedThreadRootMessageId?: null | string;
  threadLabelByRootMessageId?: Record<string, string>;
  textChannels: CommunityTextChannel[];
  textChannelNotificationSetting: (
    channel: CommunityTextChannel,
  ) => NotificationScopeSetting;
  visibleTextChannels: CommunityTextChannel[];
  visibleVoiceChannels: CommunityVoiceChannel[];
  voiceChannels: CommunityVoiceChannel[];
  voiceParticipantsByChannelId: Map<string, VoiceParticipantView[]>;
}) {
  const [menuChannelId, setMenuChannelId] = useState<string | null>(null);

  useCloseOnEscape(() => setMenuChannelId(null), !!menuChannelId);

  return (
    <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
        {copy.communities.textChannels}
      </div>
      <ClearableSearchInput
        ariaLabel={copy.communities.searchChannels}
        className="mb-3"
        clearLabel={copy.communities.clearChannelSearch}
        onChange={onChannelSearchChange}
        placeholder={copy.communities.searchChannels}
        value={channelSearch}
      />
      <div className="space-y-0.5">
        {textChannels.length === 0 && voiceChannels.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
            {copy.communities.noChannels}
          </div>
        ) : visibleTextChannels.length === 0 &&
          visibleVoiceChannels.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
            {copy.communities.noMatchingChannels}
          </div>
        ) : (
          <>
            {visibleTextChannels.map((channel) => (
              <div key={channel.id}>
                <TextChannelButton
                  active={
                    selectedChannelId === channel.id &&
                    !selectedThreadRootMessageId
                  }
                  channel={channel}
                  menuOpen={menuChannelId === channel.id}
                  notificationSetting={textChannelNotificationSetting(channel)}
                  onMenuClose={() => setMenuChannelId(null)}
                  onMenuOpen={() => setMenuChannelId(channel.id)}
                  onNotificationSettingsOpen={() => {
                    onTextChannelNotificationSettingsOpen(channel);
                    setMenuChannelId(null);
                  }}
                  onNotificationMuteToggle={() => {
                    onTextChannelMuteToggle(channel);
                    setMenuChannelId(null);
                  }}
                  onSelect={onTextChannelSelected}
                  unreadCount={channelUnreadCounts[channel.id] ?? 0}
                />
                {channel.threads && channel.threads.length > 0 ? (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                    {channel.threads
                      .slice()
                      .sort(
                        (left, right) => right.lastReplyAt - left.lastReplyAt,
                      )
                      .map((thread) => (
                        <ThreadChannelButton
                          key={thread.rootMessageId}
                          active={
                            selectedChannelId === channel.id &&
                            selectedThreadRootMessageId ===
                              thread.rootMessageId
                          }
                          label={
                            threadLabelByRootMessageId?.[
                              thread.rootMessageId
                            ] ?? shortId(thread.rootMessageId)
                          }
                          onSelect={() => onThreadSelected(channel, thread)}
                          replyCount={thread.replyCount}
                        />
                      ))}
                  </div>
                ) : null}
              </div>
            ))}
            {visibleVoiceChannels.length > 0 && (
              <div className="pt-2">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
                  {copy.calls.voiceChannels}
                </div>
                <div className="space-y-0.5">
                  {visibleVoiceChannels.map((channel) => (
                    <VoiceChannelButton
                      key={channel.id}
                      active={activeVoiceChannelId === channel.id}
                      channel={channel}
                      onJoin={onVoiceChannelJoin}
                      onParticipantClick={onVoiceParticipantClick}
                      participants={
                        voiceParticipantsByChannelId.get(channel.id) ?? []
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ThreadChannelButton({
  active,
  label,
  onSelect,
  replyCount,
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
  replyCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(
        'flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-xs font-black transition',
        active
          ? 'bg-[#c8c0d8]/85 text-[#171426] shadow-inner shadow-white/10'
          : 'text-white/60 hover:bg-white/10 hover:text-white',
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {replyCount > 0 && (
        <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[0.6rem] leading-none">
          {replyCount > 9 ? '9+' : replyCount}
        </span>
      )}
    </button>
  );
}

function TextChannelButton({
  active,
  channel,
  menuOpen,
  notificationSetting,
  onMenuClose,
  onMenuOpen,
  onNotificationSettingsOpen,
  onNotificationMuteToggle,
  onSelect,
  unreadCount,
}: {
  active: boolean;
  channel: CommunityTextChannel;
  menuOpen: boolean;
  notificationSetting: NotificationScopeSetting;
  onMenuClose: () => void;
  onMenuOpen: () => void;
  onNotificationSettingsOpen: () => void;
  onNotificationMuteToggle: () => void;
  onSelect: (channelId: string) => void;
  unreadCount: number;
}) {
  const muted = NotificationSettingsPolicy.isMuted(notificationSetting);

  return (
    <div
      className={cx(
        'group relative flex w-full items-center rounded-2xl transition',
        active
          ? 'bg-[#c8c0d8]/85 text-[#171426] shadow-inner shadow-white/10'
          : muted
            ? 'text-white/40 hover:bg-white/10 hover:text-white/70'
            : 'text-white hover:bg-white/12',
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(channel.id)}
        onContextMenu={(event) => {
          event.preventDefault();
          onMenuOpen();
        }}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-l-2xl px-3 py-1.5 text-left text-sm font-black"
      >
        <span className="min-w-0 flex-1 truncate"># {channel.name}</span>
        {unreadCount > 0 && (
          <span className="grid min-w-5 place-items-center rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-[0.65rem] leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onMenuOpen();
        }}
        className={cx(
          'mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-xl text-base transition',
          menuOpen
            ? 'bg-black/15 text-current'
            : 'text-current/45 opacity-100 hover:bg-black/10 hover:text-current sm:opacity-0 sm:group-hover:opacity-100',
        )}
        aria-label={copy.chat.conversationMenu}
        aria-expanded={menuOpen}
      >
        ⋯
      </button>
      {menuOpen && (
        <ChannelNotificationMenu
          muted={muted}
          notificationSetting={notificationSetting}
          onClose={onMenuClose}
          onNotificationSettingsOpen={onNotificationSettingsOpen}
          onNotificationMuteToggle={onNotificationMuteToggle}
        />
      )}
    </div>
  );
}

function ChannelNotificationMenu({
  muted,
  notificationSetting,
  onClose,
  onNotificationSettingsOpen,
  onNotificationMuteToggle,
}: {
  muted: boolean;
  notificationSetting: NotificationScopeSetting;
  onClose: () => void;
  onNotificationSettingsOpen: () => void;
  onNotificationMuteToggle: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-30 cursor-default"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <div className="absolute right-0 top-[calc(100%+.25rem)] z-40 min-w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#1f2029] p-1 text-sm shadow-2xl shadow-black/40">
        <button
          type="button"
          onClick={onNotificationMuteToggle}
          className="block w-full rounded-2xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
        >
          {muted ? copy.notifications.unmute : copy.notifications.mute}
        </button>
        <button
          type="button"
          onClick={onNotificationSettingsOpen}
          className="block w-full rounded-2xl px-3 py-2 text-left transition hover:bg-white/10"
        >
          <span className="block font-black text-white/80">
            {copy.notifications.settings}
          </span>
          <span className="block text-xs font-bold text-white/40">
            {notificationSettingSummary(notificationSetting)}
          </span>
        </button>
      </div>
    </>
  );
}
