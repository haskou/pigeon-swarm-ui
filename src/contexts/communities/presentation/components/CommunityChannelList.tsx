import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';

import type {
  CommunityChannelThreadSummary,
  CommunityTextChannel,
  CommunityVoiceChannel,
  NotificationScopeSetting,
} from '../../../../shared/domain/pigeonResources.types';

import { NotificationSettingsPolicy } from '../../../notifications/domain/NotificationSettingsPolicy';
import { NotificationScopeMenuActions } from '../../../notifications/presentation/components/NotificationScopeMenuActions';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { ClearableSearchInput } from '../../../../shared/presentation/components/ClearableSearchInput';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import {
  sidePanelListEnterClassName,
  sidePanelListEnterStyle,
} from '../../../../shared/presentation/sidePanelListMotion';
import { MutedNotificationsIcon } from '../../../../shared/presentation/components/MutedNotificationsIcon';
import {
  VoiceChannelButton,
  type VoiceParticipantView,
} from './VoiceParticipantView';

export function CommunityChannelList({
  activeVoiceChannelId,
  animateEntries = true,
  animationScopeKey,
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
  voiceChannelNotificationSetting,
  voiceChannels,
  voiceParticipantsByChannelId,
}: {
  activeVoiceChannelId: null | string;
  animateEntries?: boolean;
  animationScopeKey?: string;
  channelSearch: string;
  channelUnreadCounts: Record<string, number>;
  onChannelSearchChange: (value: string) => void;
  onTextChannelSelected: (channelId: string) => void;
  onThreadSelected: (
    channel: CommunityTextChannel,
    thread: CommunityChannelThreadSummary,
  ) => void;
  onTextChannelNotificationSettingsOpen: (
    channel: CommunityTextChannel,
  ) => void;
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
  voiceChannelNotificationSetting: (
    channel: CommunityVoiceChannel,
  ) => NotificationScopeSetting;
  voiceChannels: CommunityVoiceChannel[];
  voiceParticipantsByChannelId: Map<string, VoiceParticipantView[]>;
}) {
  const [menuChannelId, setMenuChannelId] = useState<string | null>(null);
  const [showMutedChannels, setShowMutedChannels] = useState(false);
  const normalizedChannelSearch = channelSearch.trim().toLowerCase();
  const hiddenMutedTextChannels = useMemo(
    () =>
      hiddenMutedChannels({
        allChannels: textChannels,
        channelSearch: normalizedChannelSearch,
        notificationSetting: textChannelNotificationSetting,
        visibleChannels: visibleTextChannels,
      }),
    [
      normalizedChannelSearch,
      textChannelNotificationSetting,
      textChannels,
      visibleTextChannels,
    ],
  );
  const hiddenMutedVoiceChannels = useMemo(
    () =>
      hiddenMutedChannels({
        allChannels: voiceChannels,
        channelSearch: normalizedChannelSearch,
        notificationSetting: voiceChannelNotificationSetting,
        visibleChannels: visibleVoiceChannels,
      }),
    [
      normalizedChannelSearch,
      voiceChannelNotificationSetting,
      visibleVoiceChannels,
      voiceChannels,
    ],
  );
  const hiddenMutedChannelCount =
    hiddenMutedTextChannels.length + hiddenMutedVoiceChannels.length;
  const displayedTextChannels = useMemo(
    () =>
      showMutedChannels
        ? orderedVisibleChannels(textChannels, [
            ...visibleTextChannels,
            ...hiddenMutedTextChannels,
          ])
        : visibleTextChannels,
    [
      hiddenMutedTextChannels,
      showMutedChannels,
      textChannels,
      visibleTextChannels,
    ],
  );
  const displayedVoiceChannels = useMemo(
    () =>
      showMutedChannels
        ? orderedVisibleChannels(voiceChannels, [
            ...visibleVoiceChannels,
            ...hiddenMutedVoiceChannels,
          ])
        : visibleVoiceChannels,
    [
      hiddenMutedVoiceChannels,
      showMutedChannels,
      visibleVoiceChannels,
      voiceChannels,
    ],
  );

  useCloseOnEscape(() => setMenuChannelId(null), !!menuChannelId);

  useEffect(() => {
    if (hiddenMutedChannelCount === 0) setShowMutedChannels(false);
  }, [hiddenMutedChannelCount]);

  return (
    <div className="mt-5 min-h-0 flex-1 overflow-x-clip overflow-y-auto pr-1">
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
        ) : displayedTextChannels.length === 0 &&
          displayedVoiceChannels.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
            {hiddenMutedChannelCount > 0 ? (
              <HiddenMutedChannelsToggle
                count={hiddenMutedChannelCount}
                expanded={showMutedChannels}
                onToggle={() => setShowMutedChannels((current) => !current)}
              />
            ) : (
              copy.communities.noMatchingChannels
            )}
          </div>
        ) : (
          <>
            {hiddenMutedChannelCount > 0 && (
              <HiddenMutedChannelsToggle
                count={hiddenMutedChannelCount}
                expanded={showMutedChannels}
                onToggle={() => setShowMutedChannels((current) => !current)}
              />
            )}
            {displayedTextChannels.map((channel, index) => (
              <div
                key={`${animationScopeKey ?? 'channels'}:${channel.id}`}
                className={sidePanelListEnterClassName('left', animateEntries)}
                style={sidePanelListEnterStyle(index, animateEntries)}
              >
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
                      .map((thread, threadIndex) => (
                        <ThreadChannelButton
                          key={`${animationScopeKey ?? 'channels'}:${channel.id}:${thread.rootMessageId}`}
                          animateEntry={animateEntries}
                          active={
                            selectedChannelId === channel.id &&
                            selectedThreadRootMessageId === thread.rootMessageId
                          }
                          enterIndex={index + threadIndex + 1}
                          label={
                            threadLabelByRootMessageId?.[
                              thread.rootMessageId
                            ] ?? copy.messages.thread
                          }
                          onSelect={() => onThreadSelected(channel, thread)}
                          replyCount={thread.replyCount}
                        />
                      ))}
                  </div>
                ) : null}
              </div>
            ))}
            {displayedVoiceChannels.length > 0 && (
              <div className="pt-2">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
                  {copy.calls.voiceChannels}
                </div>
                <div className="space-y-0.5">
                  {displayedVoiceChannels.map((channel, index) => (
                    <div
                      key={`${animationScopeKey ?? 'channels'}:${channel.id}`}
                      className={cx(
                        sidePanelListEnterClassName('left', animateEntries),
                        'relative',
                      )}
                      style={sidePanelListEnterStyle(
                        displayedTextChannels.length + index,
                        animateEntries,
                      )}
                    >
                      <VoiceChannelButton
                        active={activeVoiceChannelId === channel.id}
                        channel={channel}
                        onJoin={onVoiceChannelJoin}
                        onParticipantClick={onVoiceParticipantClick}
                        participants={
                          voiceParticipantsByChannelId.get(channel.id) ?? []
                        }
                      />
                      {NotificationSettingsPolicy.isMuted(
                        voiceChannelNotificationSetting(channel),
                      ) && (
                        <span className="pointer-events-none absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-black/25 text-white/50">
                          <MutedNotificationsIcon className="h-3 w-3" />
                        </span>
                      )}
                    </div>
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

function HiddenMutedChannelsToggle({
  count,
  expanded,
  onToggle,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mb-2 flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-black text-white/55 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
    >
      <span>
        {expanded
          ? copy.notifications.hideMutedChannelsAgain
          : copy.notifications.showMutedChannels}
      </span>
      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] leading-none text-white/50">
        {count}
      </span>
    </button>
  );
}

function hiddenMutedChannels<T extends { id: string; name: string }>({
  allChannels,
  channelSearch,
  notificationSetting,
  visibleChannels,
}: {
  allChannels: T[];
  channelSearch: string;
  notificationSetting: (channel: T) => NotificationScopeSetting;
  visibleChannels: T[];
}): T[] {
  const visibleChannelIds = new Set(
    visibleChannels.map((channel) => channel.id),
  );

  return allChannels.filter(
    (channel) =>
      (!channelSearch || channel.name.toLowerCase().includes(channelSearch)) &&
      !visibleChannelIds.has(channel.id) &&
      NotificationSettingsPolicy.shouldHide(notificationSetting(channel)),
  );
}

function orderedVisibleChannels<T extends { id: string }>(
  allChannels: T[],
  visibleChannels: T[],
): T[] {
  const visibleChannelIds = new Set(
    visibleChannels.map((channel) => channel.id),
  );

  return allChannels.filter((channel) => visibleChannelIds.has(channel.id));
}

function ThreadChannelButton({
  active,
  animateEntry,
  enterIndex,
  label,
  onSelect,
  replyCount,
}: {
  active: boolean;
  animateEntry: boolean;
  enterIndex: number;
  label: string;
  onSelect: () => void;
  replyCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={sidePanelListEnterStyle(enterIndex, animateEntry)}
      className={cx(
        sidePanelListEnterClassName('left', animateEntry),
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
  const longPressTimerRef = useRef<number | null>(null);
  const longPressOpenedRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current === null) {
      return;
    }

    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  useEffect(
    () => () => {
      if (longPressTimerRef.current === null) {
        return;
      }

      window.clearTimeout(longPressTimerRef.current);
    },
    [],
  );

  const openContextMenu = () => {
    clearLongPressTimer();
    onMenuOpen();
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse') {
      return;
    }

    clearLongPressTimer();
    longPressOpenedRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressOpenedRef.current = true;
      onMenuOpen();
    }, 450);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      event.key !== 'ContextMenu' &&
      !(event.shiftKey && event.key === 'F10')
    ) {
      return;
    }

    event.preventDefault();
    openContextMenu();
  };

  return (
    <div
      className={cx(
        'group relative w-full rounded-md border-l-2 border-transparent transition',
        active
          ? 'border-cyan-300/80 bg-[#c8c0d8]/15 text-white'
          : muted
            ? 'text-white/40 hover:bg-white/10 hover:text-white/70'
            : 'text-white hover:bg-white/12',
      )}
    >
      <button
        type="button"
        onClick={(event) => {
          if (longPressOpenedRef.current) {
            event.preventDefault();
            longPressOpenedRef.current = false;
            return;
          }

          onSelect(channel.id);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          openContextMenu();
        }}
        onKeyDown={handleKeyDown}
        onPointerCancel={clearLongPressTimer}
        onPointerDown={handlePointerDown}
        onPointerLeave={clearLongPressTimer}
        onPointerUp={clearLongPressTimer}
        className="flex w-full min-w-0 items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm font-black"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <span className="min-w-0 flex-1 truncate"># {channel.name}</span>
        {muted && (
          <span
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-black/20 text-current opacity-70"
            title={copy.notifications.mute}
          >
            <MutedNotificationsIcon className="h-3 w-3" />
          </span>
        )}
        {unreadCount > 0 && (
          <span className="grid min-w-5 place-items-center rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-[0.65rem] leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {menuOpen && (
        <ChannelNotificationMenu
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
  notificationSetting,
  onClose,
  onNotificationSettingsOpen,
  onNotificationMuteToggle,
}: {
  notificationSetting: NotificationScopeSetting;
  onClose: () => void;
  onNotificationSettingsOpen: () => void;
  onNotificationMuteToggle: () => void;
}) {
  const { close, state } = useCloseTransition(onClose);

  return (
    <>
      <button
        type="button"
        className="app-overlay-scrim fixed inset-0 z-30 cursor-default"
        data-state={state}
        onClick={close}
        onContextMenu={(event) => {
          event.preventDefault();
          close();
        }}
        aria-label={copy.dialog.close}
      />
      <div
        className="app-context-menu absolute right-0 top-[calc(100%+.25rem)] z-40 min-w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#1f2029] p-1 text-sm shadow-2xl shadow-black/40"
        data-state={state}
      >
        <NotificationScopeMenuActions
          muteLabel={copy.notifications.mute}
          notificationSetting={notificationSetting}
          onNotificationMuteToggle={() => {
            onNotificationMuteToggle();
            close();
          }}
          onNotificationSettingsOpen={() => {
            onNotificationSettingsOpen();
            close();
          }}
        />
      </div>
    </>
  );
}
