import type { MouseEvent } from 'react';

import type {
  CommunityChannelThreadSummary,
  CommunityTextChannel,
  CommunityVoiceChannel,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { shortId } from '../../../../shared/presentation/formatting';
import { ClearableSearchInput } from '../../../../shared/presentation/components/ClearableSearchInput';
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
  onVoiceChannelJoin,
  onVoiceParticipantClick,
  selectedChannelId,
  selectedThreadRootMessageId,
  threadLabelByRootMessageId,
  textChannels,
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
  onVoiceChannelJoin: (channel: CommunityVoiceChannel) => void;
  onVoiceParticipantClick: (
    participant: VoiceParticipantView,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  selectedChannelId: null | string;
  selectedThreadRootMessageId?: null | string;
  threadLabelByRootMessageId?: Record<string, string>;
  textChannels: CommunityTextChannel[];
  visibleTextChannels: CommunityTextChannel[];
  visibleVoiceChannels: CommunityVoiceChannel[];
  voiceChannels: CommunityVoiceChannel[];
  voiceParticipantsByChannelId: Map<string, VoiceParticipantView[]>;
}) {
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
  onSelect,
  unreadCount,
}: {
  active: boolean;
  channel: CommunityTextChannel;
  onSelect: (channelId: string) => void;
  unreadCount: number;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(channel.id)}
      className={cx(
        'flex w-full items-center gap-2 rounded-2xl px-3 py-1.5 text-left text-sm font-black transition',
        active
          ? 'bg-[#c8c0d8]/85 text-[#171426] shadow-inner shadow-white/10'
          : 'text-white hover:bg-white/12',
      )}
    >
      <span className="min-w-0 flex-1 truncate"># {channel.name}</span>
      {unreadCount > 0 && (
        <span className="grid min-w-5 place-items-center rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-[0.65rem] leading-none text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
