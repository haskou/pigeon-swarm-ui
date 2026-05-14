import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type { Community, Session } from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import { Field } from '../auth/Field';
import { GlassSelect } from '../common/GlassSelect';

interface CreateCommunityDialogProps {
  nodeNetworks: NodeNetwork[];
  onClose: () => void;
  onCreated: (input: { community: Community; session: Session }) => void;
  session: Session;
}

export function CreateCommunityDialog({
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
  const [state, setState] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState<string | null>(null);
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

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    setAvatar(file);
    setAvatarPreview(null);
    if (!file) return;

    const reader = new FileReader();

    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') setAvatarPreview(reader.result);
    });
    reader.readAsDataURL(file);
  };

  const handleBannerChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    setBanner(file);
    setBannerPreview(null);
    if (!file) return;

    const reader = new FileReader();

    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') setBannerPreview(reader.result);
    });
    reader.readAsDataURL(file);
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
    <div className="fixed inset-0 z-50 grid place-items-stretch bg-black/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="glass-panel-strong flex min-h-screen w-full flex-col justify-center rounded-none p-5 sm:min-h-0 sm:max-w-xl sm:rounded-[2rem] sm:p-6"
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

        <div className="mt-5 grid gap-4">
          <Field label={copy.communities.name}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
              placeholder={copy.communities.namePlaceholder}
              autoComplete="off"
            />
          </Field>

          <Field label={copy.communities.description}>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
              placeholder={copy.communities.descriptionPlaceholder}
            />
          </Field>

          <Field label={copy.communities.network}>
            <GlassSelect
              ariaLabel={copy.communities.network}
              value={networkId}
              onChange={setNetworkId}
              options={networkOptions}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
            <label className="grid gap-2 text-sm font-black text-white/70">
              {copy.communities.avatar}
              <div className="rounded-3xl bg-black/20 p-3">
                <div className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-2xl font-black text-slate-950">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    name.slice(0, 1).toUpperCase() || 'C'
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="mt-3 w-full text-xs text-white/60 file:mb-2 file:mr-0 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:font-black file:text-slate-950"
                />
              </div>
            </label>

            <label className="grid gap-2 text-sm font-black text-white/70">
              {copy.communities.banner}
              <div className="flex items-center gap-4 rounded-3xl bg-black/20 p-3">
                <div className="grid h-20 w-32 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950">
                  {bannerPreview ? (
                    <img
                      src={bannerPreview}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    name.slice(0, 1).toUpperCase() || 'C'
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBannerChange}
                  className="min-w-0 flex-1 text-sm text-white/60 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:font-black file:text-slate-950"
                />
              </div>
            </label>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-sm text-rose-100">
            {error}
          </div>
        )}

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
            className="glass-button rounded-2xl bg-fuchsia-500 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {state === 'loading'
              ? copy.communities.creating
              : copy.communities.create}
          </button>
        </div>
      </form>
    </div>
  );
}
