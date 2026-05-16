import { UUID } from '@haskou/value-objects';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Community, CommunityChannel, Session } from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import {
  communityChannels,
  splitCommunityChannels,
} from '../../domain/communities/communityChannels';
import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import {
  DialogHeader,
  TrashIcon,
  VoiceIcon,
} from './communityDialogPrimitives';
import { loadPublicImage } from './communityImages';

type ManagedCommunityChannel = CommunityChannel & { pending?: boolean };

type ManageCommunityDialogProps = {
  community: Community;
  onClose: () => void;
  onCommunityUpdated: (community: Community) => void;
  session: Session;
};

export function ManageCommunityDialog({
  community,
  onClose,
  onCommunityUpdated,
  session,
}: ManageCommunityDialogProps) {
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [currentBannerUrl, setCurrentBannerUrl] = useState<string | null>(null);
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<'text' | 'voice'>('text');
  const [channelOrder, setChannelOrder] = useState<ManagedCommunityChannel[]>(
    communityChannels(community),
  );
  const [deletedChannelIds, setDeletedChannelIds] = useState<string[]>([]);
  const [channelDrafts, setChannelDrafts] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        communityChannels(community).map((channel) => [
          channel.id,
          channel.name,
        ]),
      ),
  );
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading'>('idle');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!avatar) {
      setAvatarPreview(null);

      return undefined;
    }

    const nextPreview = URL.createObjectURL(avatar);

    setAvatarPreview(nextPreview);

    return () => URL.revokeObjectURL(nextPreview);
  }, [avatar]);

  useEffect(() => {
    if (!banner) {
      setBannerPreview(null);

      return undefined;
    }

    const nextPreview = URL.createObjectURL(banner);

    setBannerPreview(nextPreview);

    return () => URL.revokeObjectURL(nextPreview);
  }, [banner]);

  useEffect(() => {
    let cancelled = false;

    setCurrentAvatarUrl(null);
    if (!community.avatar) return undefined;

    void loadPublicImage(community.avatar).then((url) => {
      if (!cancelled) setCurrentAvatarUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [community.avatar]);

  useEffect(() => {
    let cancelled = false;

    setCurrentBannerUrl(null);
    if (!community.banner) return undefined;

    void loadPublicImage(community.banner).then((url) => {
      if (!cancelled) setCurrentBannerUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [community.banner]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const saveChanges = async (): Promise<boolean> => {
    if (state === 'loading') return false;

    if (
      channelOrder.some(
        (channel) => !(channelDrafts[channel.id] ?? channel.name).trim(),
      )
    ) {
      setError(copy.communities.channelError);

      return false;
    }

    setState('loading');
    setError(null);
    try {
      let updatedCommunity = await pigeonApplication.updateCommunity(
        session,
        community.id,
        {
          avatar: avatar ?? community.avatar,
          banner: banner ?? community.banner,
          description: description.trim(),
          name: name.trim(),
        },
      );

      for (const channelId of deletedChannelIds) {
        updatedCommunity = await pigeonApplication.deleteCommunityChannel(
          session,
          community.id,
          channelId,
        );
      }

      const updatedChannels: CommunityChannel[] = [];

      for (const channel of channelOrder) {
        const nextName = (channelDrafts[channel.id] ?? channel.name).trim();

        if (channel.pending) {
          updatedChannels.push(
            channel.type === 'text'
              ? await pigeonApplication.createCommunityTextChannel(
                  session,
                  community.id,
                  nextName,
                )
              : await pigeonApplication.createCommunityVoiceChannel(
                  session,
                  community.id,
                  nextName,
                ),
          );
        } else if (nextName === channel.name) {
          updatedChannels.push(channel);
        } else {
          updatedChannels.push(
            await pigeonApplication.renameCommunityChannel(
              session,
              community.id,
              channel.id,
              nextName,
            ),
          );
        }
      }

      onCommunityUpdated({
        ...updatedCommunity,
        ...splitCommunityChannels(updatedChannels),
      });

      return true;
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.updateError));

      return false;
    } finally {
      setState('idle');
    }
  };

  const finishManage = async () => {
    const saved = await saveChanges();

    if (!saved) return;
    onClose();
  };

  const createChannel = () => {
    const nextName = channelName.trim();

    if (!nextName || state === 'loading') return;

    setError(null);
    const channel: ManagedCommunityChannel =
      channelType === 'text'
        ? {
            createdAt: Date.now(),
            id: draftChannelId(),
            name: nextName,
            pending: true,
            type: 'text',
          }
        : {
            connectedIdentityIds: [],
            createdAt: Date.now(),
            id: draftChannelId(),
            name: nextName,
            pending: true,
            type: 'voice',
          };

    setChannelName('');
    setChannelOrder((current) => [...current, channel]);
    setChannelDrafts((current) => ({
      ...current,
      [channel.id]: channel.name,
    }));
  };

  const moveChannel = (channelId: string, direction: -1 | 1) => {
    const index = channelOrder.findIndex((channel) => channel.id === channelId);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= channelOrder.length) return;

    const nextChannels = [...channelOrder];
    const [channel] = nextChannels.splice(index, 1);

    nextChannels.splice(nextIndex, 0, channel);
    setChannelOrder(nextChannels);
  };

  const deleteChannel = (channel: ManagedCommunityChannel) => {
    if (
      channel.type === 'text' &&
      !window.confirm(copy.communities.deleteChannelConfirm)
    )
      return;

    setChannelOrder((current) =>
      current.filter((candidate) => candidate.id !== channel.id),
    );
    setChannelDrafts((current) => {
      const { [channel.id]: _deleted, ...remaining } = current;

      return remaining;
    });

    if (!channel.pending) {
      setDeletedChannelIds((current) =>
        current.includes(channel.id) ? current : [...current, channel.id],
      );
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="glass-panel-strong relative z-10 flex max-h-screen w-full flex-col overflow-hidden rounded-none p-5 shadow-2xl shadow-black/40 sm:max-h-[88vh] sm:max-w-5xl sm:rounded-2xl">
        <DialogHeader title={copy.communities.manage} onClose={onClose} />
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-start">
            <div className="overflow-hidden rounded-[1.75rem] bg-black/25">
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="group relative block aspect-[3/1] w-full overflow-hidden bg-gradient-to-br from-slate-900 via-fuchsia-950 to-cyan-900"
                aria-label={copy.communities.banner}
              >
                {bannerPreview || currentBannerUrl ? (
                  <img
                    src={bannerPreview ?? currentBannerUrl ?? ''}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center text-4xl font-black text-white/80">
                    {community.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/0 text-3xl text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                  ✎
                </span>
              </button>
              <div className="relative px-4 pb-4">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="group relative -mt-8 grid h-20 w-20 place-items-center overflow-hidden rounded-[1.65rem] border-4 border-[#1f1f27] bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-3xl font-black text-slate-950 shadow-xl shadow-black/35"
                  aria-label={copy.communities.avatar}
                >
                  {avatarPreview || currentAvatarUrl ? (
                    <img
                      src={avatarPreview ?? currentAvatarUrl ?? ''}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    community.name.slice(0, 1).toUpperCase()
                  )}
                  <span className="absolute inset-0 grid place-items-center bg-black/0 text-2xl text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                    ✎
                  </span>
                </button>
                <div className="mt-4 grid gap-3">
                  <input
                    aria-label={copy.communities.name}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-lg font-black text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  />
                  <textarea
                    aria-label={copy.communities.description}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  />
                </div>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => setBanner(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-4">
              <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/35">
                {copy.communities.channels}
              </div>
              <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">
                {channelOrder.map((channel, index) => (
                  <div
                    key={channel.id}
                    className="flex items-center gap-2 rounded-2xl bg-white/8 p-2"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/55">
                      {channel.type === 'voice' ? <VoiceIcon /> : '#'}
                    </span>
                    <input
                      value={channelDrafts[channel.id] ?? channel.name}
                      onChange={(event) =>
                        setChannelDrafts((current) => ({
                          ...current,
                          [channel.id]: event.target.value,
                        }))
                      }
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                    />
                    <span className="hidden rounded-xl bg-black/25 px-2 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/35 sm:block">
                      {channel.type === 'voice'
                        ? copy.communities.voiceChannel
                        : copy.communities.textChannel}
                    </span>
                    <button
                      type="button"
                      onClick={() => moveChannel(channel.id, -1)}
                      disabled={index === 0}
                      className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 font-black disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={copy.communities.moveChannelUp}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveChannel(channel.id, 1)}
                      disabled={index === channelOrder.length - 1}
                      className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 font-black disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={copy.communities.moveChannelDown}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteChannel(channel)}
                      disabled={state === 'loading'}
                      className="grid h-9 w-9 place-items-center rounded-xl bg-rose-500/15 text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={copy.communities.deleteChannel}
                      title={copy.communities.deleteChannel}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-black/20 p-1">
                {(['text', 'voice'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setChannelType(type)}
                    className={cx(
                      'rounded-xl px-3 py-2 text-xs font-black transition',
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
                  onChange={(event) => setChannelName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    void createChannel();
                  }}
                  className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  placeholder={copy.communities.addChannelPlaceholder}
                />
                <button
                  type="button"
                  onClick={() => void createChannel()}
                  disabled={!channelName.trim() || state === 'loading'}
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          {error && (
            <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-xs text-rose-100">
              {error}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => void finishManage()}
          disabled={!name.trim() || state === 'loading'}
          className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {copy.profile.save}
        </button>
      </section>
    </div>,
    document.body,
  );
}

function draftChannelId(): string {
  return `draft:${UUID.generate().toString()}`;
}
