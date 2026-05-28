import type { MouseEvent } from 'react';

import type {
  CommunityTextChannel,
  CommunityVoiceChannel,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
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
  onVoiceChannelJoin,
  onVoiceParticipantClick,
  selectedChannelId,
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
  onVoiceChannelJoin: (channel: CommunityVoiceChannel) => void;
  onVoiceParticipantClick: (
    participant: VoiceParticipantView,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  selectedChannelId: null | string;
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
              <TextChannelButton
                key={channel.id}
                active={selectedChannelId === channel.id}
                channel={channel}
                onSelect={onTextChannelSelected}
                unreadCount={channelUnreadCounts[channel.id] ?? 0}
              />
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
          ? 'bg-white text-slate-950'
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
