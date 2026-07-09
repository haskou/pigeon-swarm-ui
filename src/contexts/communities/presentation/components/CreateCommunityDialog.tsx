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

import type { NodeNetwork } from '../../../networks/application/list-node-networks/ListNodeNetworks';
import type {
  Community,
  CommunityVisibility,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { GlassSelect } from '../../../../shared/presentation/components/glassSelect';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { CommunityPublicSettingsPanel } from './CommunityPublicSettingsPanel';

const ImageCropEditor = lazy(() =>
  import('../../../../shared/presentation/components/ImageCropEditor').then(
    (module) => ({
      default: module.ImageCropEditor,
    }),
  ),
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

const maxChannelNameLength = 32;
const channelNamePattern = /^[a-z0-9][a-z0-9_-]*$/;

export function CreateCommunityDialog({
  headerControl,
  nodeNetworks,
  onClose,
  onCreated,
  session,
}: CreateCommunityDialogProps) {
  const { close, state: transitionState } = useCloseTransition(onClose);

  useCloseOnEscape(close);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [networkId, setNetworkId] = useState(
    session.identity.networks[0] ?? '',
  );
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [autoJoinEnabled, setAutoJoinEnabled] = useState(false);
  const [discoverable, setDiscoverable] = useState(true);
  const [visibility, setVisibility] = useState<CommunityVisibility>('private');
  const [imageEditor, setImageEditor] = useState<{
    file: File;
    shape: 'avatar' | 'banner';
  } | null>(null);
  const [channelName, setChannelName] = useState('');
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
  const channelInputError = channelName.trim()
    ? channelValidationError(channelName, channels)
    : null;
  const canAddChannel = channelName.trim().length > 0 && !channelInputError;
  const canSubmit =
    name.trim().length > 0 &&
    channels.length > 0 &&
    channels.every((channel) => channelNameIsValid(channel.name)) &&
    channelNamesAreUnique(channels) &&
    networkId.length > 0 &&
    state !== 'loading';

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

    const validationError = channelValidationError(trimmed, channels);

    if (validationError) return;

    setChannels((current) => [
      ...current,
      { name: normalizeChannelName(trimmed), type: channelType },
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
      const effectiveAutoJoinEnabled =
        visibility === 'public' ? autoJoinEnabled : false;
      const created = await applicationContainer.createCommunity(session, {
        autoJoinEnabled: effectiveAutoJoinEnabled,
        avatar,
        banner,
        channels: channels
          .map((channel) => ({ ...channel, name: channel.name.trim() }))
          .filter((channel) => channel.name.length > 0),
        description: description.trim(),
        discoverable,
        name: name.trim(),
        networkId,
        visibility,
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
    <div
      className="app-overlay-scrim fixed inset-0 z-50 grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4"
      data-state={transitionState}
    >
      <button
        type="button"
        className="absolute inset-0"
        onClick={close}
        aria-label={copy.dialog.close}
      />
      <form
        onSubmit={handleSubmit}
        className="app-overlay-surface app-safe-area-fullscreen-surface ui-dialog-surface relative z-10 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden sm:h-[92vh] sm:max-h-[92vh] sm:max-w-5xl"
        data-state={transitionState}
      >
        <DialogHeader
          description={copy.communities.createBody}
          title={copy.communities.createTitle}
          onClose={close}
        />
        <div className="px-5">{headerControl}</div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:items-start">
            <div className="grid gap-4">
              <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-black/10">
                <div className="px-4 pt-4 text-sm font-semibold text-white/55">
                  {copy.communities.preview}
                </div>
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  className="group relative mt-3 block aspect-[3/1] w-full overflow-hidden bg-gradient-to-br from-slate-900 via-fuchsia-950 to-cyan-900"
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
                    className="group relative -mt-8 grid h-20 w-20 place-items-center overflow-hidden rounded-lg border-4 border-[#1f1f27] bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-3xl font-black text-slate-950 shadow-xl shadow-black/35"
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
                    <label className="grid gap-1.5 text-sm font-semibold text-white/65">
                      {copy.communities.name}
                      <input
                        aria-label={copy.communities.name}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="ui-field-control px-4 py-3 text-base font-semibold placeholder:text-white/30"
                        placeholder={copy.communities.namePlaceholder}
                        autoComplete="off"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-semibold text-white/65">
                      {copy.communities.description}
                      <textarea
                        aria-label={copy.communities.description}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        className="ui-field-control min-h-24 resize-none px-4 py-3 text-sm placeholder:text-white/30"
                        placeholder={copy.communities.descriptionPlaceholder}
                      />
                    </label>
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

              <div className="ui-section py-3">
                <div className="mb-3 text-sm font-semibold text-white/65">
                  {copy.communities.network}
                </div>
                <GlassSelect
                  ariaLabel={copy.communities.network}
                  value={networkId}
                  onChange={setNetworkId}
                  options={networkOptions}
                />
                <p className="mt-3 text-xs leading-relaxed text-white/45">
                  {copy.communities.networkCreateHelp}
                </p>
              </div>
              <CommunityPublicSettingsPanel
                autoJoinEnabled={autoJoinEnabled}
                discoverable={discoverable}
                disabled={state === 'loading'}
                framed={false}
                onAutoJoinChange={setAutoJoinEnabled}
                onDiscoverableChange={setDiscoverable}
                onVisibilityChange={setVisibility}
                visibility={visibility}
              />
            </div>

            <div className="ui-section py-3">
              <div className="text-sm font-semibold text-white/65">
                {copy.communities.initialChannels}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/45">
                {copy.communities.initialChannelsBody}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <input
                  value={channelName}
                  onChange={(event) => setChannelName(event.target.value)}
                  className="ui-field-control min-w-0 flex-1 px-4 py-3 text-sm placeholder:text-white/30"
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
                      { label: copy.communities.textChannel, value: 'text' },
                      { label: copy.communities.voiceChannel, value: 'voice' },
                    ]}
                  />
                  <button
                    type="button"
                    onClick={addChannel}
                    disabled={!canAddChannel}
                    className="ui-button"
                  >
                    {copy.communities.addInitialChannel}
                  </button>
                </div>
                {channelInputError ? (
                  <p className="text-xs font-bold text-rose-200">
                    {channelInputError}
                  </p>
                ) : null}
              </div>
              {channels.length > 0 && (
                <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
                  {channels.map((channel, index) => (
                    <button
                      type="button"
                      key={`${channel.type}:${channel.name}:${index}`}
                      onClick={() => removeChannel(index)}
                      className="flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left text-sm font-semibold text-white/70 transition hover:bg-rose-500/10 hover:text-rose-100"
                      title={copy.messages.delete}
                    >
                      <span>
                        {channelTypeLabel(channel.type)} · #{channel.name}
                      </span>
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="ui-inline-notice mt-4 border-rose-300/25 bg-rose-500/10 text-sm text-rose-100">
              {error}
            </div>
          )}
        </div>

        <div className="mt-4 shrink-0 border-t border-white/10 px-5 py-4">
          <div className="flex justify-end">
            <button
              disabled={!canSubmit}
              className="ui-button ui-button-primary w-full sm:w-auto"
            >
              {state === 'loading'
                ? copy.communities.creating
                : copy.communities.create}
            </button>
          </div>
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

function channelTypeLabel(type: InitialChannelDraft['type']): string {
  return type === 'voice'
    ? copy.communities.voiceChannel
    : copy.communities.textChannel;
}

function channelValidationError(
  name: string,
  channels: InitialChannelDraft[],
): string | null {
  const normalized = normalizeChannelName(name);

  if (!channelNameIsValid(normalized)) {
    return copy.communities.invalidChannelName;
  }

  if (
    channels.some(
      (channel) => normalizeChannelName(channel.name) === normalized,
    )
  ) {
    return copy.communities.duplicateChannelName;
  }

  return null;
}

function channelNameIsValid(name: string): boolean {
  const normalized = normalizeChannelName(name);

  return (
    normalized.length > 0 &&
    normalized.length <= maxChannelNameLength &&
    channelNamePattern.test(normalized)
  );
}

function channelNamesAreUnique(channels: InitialChannelDraft[]): boolean {
  const uniqueNames = new Set(
    channels.map((channel) => normalizeChannelName(channel.name)),
  );

  return uniqueNames.size === channels.length;
}

function normalizeChannelName(name: string): string {
  return name.trim().toLowerCase();
}
