import {
  ChangeEvent,
  FormEvent,
  lazy,
  Suspense,
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { NodeNetwork } from '../../../networks/application/list-node-networks/listNodeNetworks';
import type { Community, Session } from '../../../../shared/domain/pigeonResources.types';

import { pigeonApplication } from '../../../../app/composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/en';
import { cx } from '../../../../shared/presentation/classNameHelper';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { GlassSelect } from '../../../../shared/presentation/components/glassSelect';

const ImageCropEditor = lazy(() =>
  import('../../../../shared/presentation/components/imageCropEditor').then((module) => ({
    default: module.ImageCropEditor,
  })),
);

interface CreateCommunityDialogProps {
  headerControl?: ReactElement;
  nodeNetworks: NodeNetwork[];
  onClose: () => void;
  onCreated: (input: { community: Community; session: Session }) => void;
  session: Session;
}

type InitialChannelDraft = {
  name: string;
  type: 'text' | 'voice';
};

export function CreateCommunityDialog({
  headerControl,
  nodeNetworks,
  onClose,
  onCreated,
  session,
}: CreateCommunityDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [networkId, setNetworkId] = useState(
    session.identity.networks[0] ?? '',
  );
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [imageEditor, setImageEditor] = useState<{
    file: File;
    shape: 'avatar' | 'banner';
  } | null>(null);
  const [channelName, setChannelName] = useState('general');
  const [channelType, setChannelType] = useState<'text' | 'voice'>('text');
  const [channels, setChannels] = useState<InitialChannelDraft[]>([
    { name: 'general', type: 'text' },
  ]);
  const [state, setState] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const networkOptions = useMemo(
    () =>
      session.identity.networks.map((id) => ({
        label: nodeNetworks.find((network) => network.id === id)?.name ?? id,
        value: id,
      })),
    [nodeNetworks, session.identity.networks],
  );
  const canSubmit =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    networkId.length > 0 &&
    state !== 'loading';

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', closeOnEscape);

    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

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

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) setImageEditor({ file, shape: 'avatar' });
    event.target.value = '';
  };

  const handleBannerChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) setImageEditor({ file, shape: 'banner' });
    event.target.value = '';
  };
  const addChannel = () => {
    const trimmed = channelName.trim();

    if (!trimmed) return;

    setChannels((current) => [
      ...current,
      { name: trimmed, type: channelType },
    ]);
    setChannelName('');
  };
  const removeChannel = (indexToRemove: number) => {
    setChannels((current) =>
      current.filter((_, index) => index !== indexToRemove),
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!canSubmit) return;

    setState('loading');
    setError(null);
    try {
      const created = await pigeonApplication.createCommunity(session, {
        avatar,
        banner,
        channels: channels
          .map((channel) => ({ ...channel, name: channel.name.trim() }))
          .filter((channel) => channel.name.length > 0),
        description: description.trim(),
        name: name.trim(),
        networkId,
      });

      onCreated({
        community: created.community,
        session: {
          ...session,
          keychain: created.keychain,
          keychainExternalIdentifier: created.keychainExternalIdentifier,
        },
      });
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.createError));
    }
    setState('idle');
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <form
        onSubmit={handleSubmit}
        className="glass-panel-strong relative z-10 flex max-h-screen min-h-screen w-full flex-col overflow-hidden rounded-none p-5 shadow-2xl shadow-black/40 sm:min-h-0 sm:max-h-[92vh] sm:max-w-5xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight">
              {copy.communities.createTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              {copy.communities.createBody}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.dialog.close}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 font-black"
          >
            ×
          </button>
        </div>
        {headerControl}

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:items-start">
            <div className="grid gap-4">
              <div className="overflow-hidden rounded-2xl bg-black/25">
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  className="group relative block aspect-[3/1] w-full overflow-hidden bg-gradient-to-br from-slate-900 via-fuchsia-950 to-cyan-900"
                  aria-label={copy.communities.banner}
                >
                  {bannerPreview ? (
                    <img
                      src={bannerPreview}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-4xl font-black text-white/80">
                      {name.slice(0, 1).toUpperCase() || 'C'}
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
                    className="group relative -mt-8 grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border-4 border-[#1f1f27] bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-3xl font-black text-slate-950 shadow-xl shadow-black/35"
                    aria-label={copy.communities.avatar}
                  >
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      name.slice(0, 1).toUpperCase() || 'C'
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
                      placeholder={copy.communities.namePlaceholder}
                      autoComplete="off"
                    />
                    <textarea
                      aria-label={copy.communities.description}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                      placeholder={copy.communities.descriptionPlaceholder}
                    />
                  </div>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="sr-only"
                />
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerChange}
                  className="sr-only"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/35">
                  {copy.communities.network}
                </div>
                <GlassSelect
                  ariaLabel={copy.communities.network}
                  value={networkId}
                  onChange={setNetworkId}
                  options={networkOptions}
                />
                <p className="mt-3 text-xs leading-relaxed text-white/45">
                  {copy.communities.createBody}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
                {copy.communities.initialChannels}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/45">
                {copy.communities.initialChannelsBody}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <input
                  value={channelName}
                  onChange={(event) => setChannelName(event.target.value)}
                  className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  placeholder={copy.communities.initialChannelName}
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <GlassSelect
                    ariaLabel={copy.communities.channels}
                    value={channelType}
                    onChange={(value) =>
                      setChannelType(value === 'voice' ? 'voice' : 'text')
                    }
                    options={[
                      { label: 'Text', value: 'text' },
                      { label: 'Voice', value: 'voice' },
                    ]}
                  />
                  <button
                    type="button"
                    onClick={addChannel}
                    className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white/75 transition hover:bg-white/15"
                  >
                    {copy.communities.addInitialChannel}
                  </button>
                </div>
              </div>
              {channels.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {channels.map((channel, index) => (
                    <button
                      type="button"
                      key={`${channel.type}:${channel.name}:${index}`}
                      onClick={() => removeChannel(index)}
                      className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-black text-white/70 transition hover:bg-rose-500/15 hover:text-rose-100"
                      title={copy.messages.delete}
                    >
                      {channel.type === 'voice' ? 'Voice' : 'Text'} #
                      {channel.name} ×
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-sm text-rose-100">
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white/70"
          >
            {copy.dialog.cancel}
          </button>
          <button
            disabled={!canSubmit}
            className={cx(
              'rounded-2xl px-5 py-3 text-sm font-black transition',
              canSubmit
                ? 'glass-button bg-fuchsia-500 text-white hover:bg-fuchsia-400'
                : 'cursor-not-allowed bg-white/10 text-white/35',
            )}
          >
            {state === 'loading'
              ? copy.communities.creating
              : copy.communities.create}
          </button>
        </div>
        {imageEditor && (
          <Suspense fallback={null}>
            <ImageCropEditor
              file={imageEditor.file}
              shape={imageEditor.shape}
              onClose={() => setImageEditor(null)}
              onApply={(file, previewUrl) => {
                if (imageEditor.shape === 'avatar') {
                  setAvatar(file);
                  setAvatarPreview(previewUrl);
                } else {
                  setBanner(file);
                  setBannerPreview(previewUrl);
                }
              }}
            />
          </Suspense>
        )}
      </form>
    </div>
  );
}
