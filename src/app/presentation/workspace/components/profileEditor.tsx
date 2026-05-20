import {
  ChangeEvent,
  FormEvent,
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import type { NodeNetwork } from '../../../../modules/networks/application/list-node-networks/listNodeNetworks';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { pigeonApplication } from '../../../../app/composition/applicationContainer';
import { ProfileBiography } from '../../../../modules/identities/domain/profile/profileBiography';
import { ProfileHandle } from '../../../../modules/identities/domain/profile/profileHandle';
import { ProfileName } from '../../../../modules/identities/domain/profile/profileName';
import { copy } from '../../../../shared/presentation/i18n/en';
import { cx } from '../../../../shared/presentation/classNameHelper';
import {
  isValidPassword,
  passwordValidationChecks,
} from '../../../../modules/identities/presentation/auth/credentialsValidation';
import { shortId } from '../../../../shared/presentation/formatting';
import {
  isValidHandle,
  normalizeHandle,
  profilePictureUrl,
  publicFileObjectUrl,
} from '../../../../modules/identities/presentation/view-models/identityDisplay';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { GlassSelect } from '../../../../shared/presentation/components/glassSelect';

const ImageCropEditor = lazy(() =>
  import('../../../../shared/presentation/components/imageCropEditor').then(
    (module) => ({
      default: module.ImageCropEditor,
    }),
  ),
);

export function ProfileEditor({
  currentPicture,
  nodeNetworks,
  onClose,
  onUpdated,
  session,
}: {
  currentPicture?: string | null;
  nodeNetworks: NodeNetwork[];
  session: Session;
  onClose: () => void;
  onUpdated: (session: Session) => void;
}) {
  const [name, setName] = useState(session.identity.profile.name);
  const [handle, setHandle] = useState(session.identity.profile.handle ?? '');
  const [biography, setBiography] = useState(
    session.identity.profile.biography ?? '',
  );
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [passwordSectionOpen, setPasswordSectionOpen] = useState(false);
  const [identityNetworkIds, setIdentityNetworkIds] = useState(
    session.identity.networks,
  );
  const [networkToAdd, setNetworkToAdd] = useState('');
  const [picturePreview, setPicturePreview] = useState(
    currentPicture ??
      (session.identity.profile.picture
        ? profilePictureUrl(session.identity.profile.picture)
        : null),
  );
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [imageEditor, setImageEditor] = useState<{
    file: File;
    shape: 'avatar' | 'banner';
  } | null>(null);
  const pictureInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const normalizedHandle = handle.trim() ? normalizeHandle(handle) : undefined;
  const wantsPasswordChange =
    newPassword.length > 0 || newPasswordConfirmation.length > 0;
  const passwordChecks = passwordValidationChecks(newPassword);
  const passwordsMatch =
    newPassword.length > 0 && newPassword === newPasswordConfirmation;
  const canChangePassword =
    !wantsPasswordChange || (isValidPassword(newPassword) && passwordsMatch);
  const canSubmit =
    name.trim().length > 0 &&
    identityNetworkIds.length > 0 &&
    (!normalizedHandle || isValidHandle(normalizedHandle)) &&
    canChangePassword &&
    state !== 'loading';
  const nodeNetworkOptions = useMemo(
    () =>
      nodeNetworks
        .filter((network) => !identityNetworkIds.includes(network.id))
        .map((network) => ({ label: network.name, value: network.id })),
    [identityNetworkIds, nodeNetworks],
  );
  const networkNamesById = useMemo(
    () => new Map(nodeNetworks.map((network) => [network.id, network.name])),
    [nodeNetworks],
  );

  useEffect(() => {
    if (nodeNetworkOptions.some((option) => option.value === networkToAdd)) {
      return;
    }

    setNetworkToAdd(nodeNetworkOptions[0]?.value ?? '');
  }, [networkToAdd, nodeNetworkOptions]);

  useEffect(() => {
    const banner = session.identity.profile.banner?.trim();

    if (!banner) {
      setBannerPreview(null);

      return;
    }

    const directBanner = profilePictureUrl(banner);

    if (directBanner) {
      setBannerPreview(directBanner);

      return;
    }

    let active = true;

    void pigeonApplication
      .getPublicFile(banner)
      .then((content) => {
        if (active) setBannerPreview(publicFileObjectUrl(content));
      })
      .catch(() => {
        if (active) setBannerPreview(null);
      });

    return () => {
      active = false;
    };
  }, [session.identity.profile.banner]);

  const addNetwork = () => {
    if (!networkToAdd || identityNetworkIds.includes(networkToAdd)) return;

    setIdentityNetworkIds((networkIds) => [...networkIds, networkToAdd]);
  };

  const handlePictureChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) setImageEditor({ file, shape: 'avatar' });
    event.target.value = '';
  };

  const handleBannerChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) setImageEditor({ file, shape: 'banner' });
    event.target.value = '';
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!canSubmit) return;

    setState('loading');
    setError(null);
    try {
      const pictureCid = pictureFile
        ? (await pigeonApplication.uploadPublicFile(session, pictureFile)).cid
        : session.identity.profile.picture?.trim() || undefined;
      const bannerCid = bannerFile
        ? (await pigeonApplication.uploadPublicFile(session, bannerFile)).cid
        : session.identity.profile.banner?.trim() || undefined;
      const identity = await pigeonApplication.updateIdentityProfile(
        session,
        {
          banner: bannerCid,
          biography: biography.trim() || undefined,
          handle: normalizedHandle,
          name: name.trim(),
          networks: identityNetworkIds,
          picture: pictureCid,
        },
        wantsPasswordChange ? newPassword : undefined,
      );

      onUpdated({
        ...session,
        identity,
        password: wantsPasswordChange ? newPassword : session.password,
      });
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.profile.updateError));
    }
    setState('idle');
  };

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <form
        onSubmit={handleSubmit}
        className="glass-panel-strong relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5 shadow-2xl shadow-black/35 sm:max-w-5xl sm:p-6 lg:p-8"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <h2 className="text-xl font-black">{copy.profile.edit}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70"
            aria-label={copy.dialog.close}
          >
            ×
          </button>
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] lg:items-start xl:gap-6">
          <div className="overflow-hidden rounded-2xl bg-black/25">
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              className="group relative block aspect-[3/1] w-full overflow-hidden bg-gradient-to-br from-slate-900 via-fuchsia-950 to-cyan-900"
              aria-label={copy.profile.changeBanner}
            >
              {bannerPreview && (
                <img
                  src={bannerPreview}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/0 text-3xl opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                ✎
              </span>
            </button>
            <div className="relative px-4 pb-4">
              <button
                type="button"
                onClick={() => pictureInputRef.current?.click()}
                className="group relative -mt-9 grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border-4 border-[#1f1f27] bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-3xl font-black text-slate-950 shadow-xl shadow-black/35"
                aria-label={copy.profile.changePicture}
              >
                {picturePreview ? (
                  <img
                    src={picturePreview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (name || session.identity.id).slice(0, 1).toUpperCase()
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/0 text-2xl text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                  ✎
                </span>
              </button>
              <div className="mt-4 grid gap-3">
                <ProfileEditorField label={copy.profile.name}>
                  <input
                    aria-label={copy.profile.name}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={ProfileName.MAX_LENGTH}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-lg font-black text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  />
                </ProfileEditorField>
                <ProfileEditorField label={copy.profile.handle}>
                  <input
                    aria-label={copy.profile.handle}
                    value={handle}
                    onChange={(event) =>
                      setHandle(normalizeHandle(event.target.value))
                    }
                    maxLength={ProfileHandle.MAX_LENGTH}
                    placeholder="@ada"
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-bold text-white/70 outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  />
                </ProfileEditorField>
                <ProfileEditorField label={copy.profile.biography}>
                  <textarea
                    aria-label={copy.profile.biography}
                    value={biography}
                    onChange={(event) => setBiography(event.target.value)}
                    maxLength={ProfileBiography.MAX_LENGTH}
                    className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-normal text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  />
                </ProfileEditorField>
              </div>
            </div>
            <input
              ref={pictureInputRef}
              type="file"
              accept="image/*"
              onChange={handlePictureChange}
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
          <div className="grid min-w-0 gap-4">
            <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-black text-white/70">
                {copy.profile.networks}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {identityNetworkIds.length > 0 ? (
                  identityNetworkIds.map((networkId) => (
                    <span
                      key={networkId}
                      title={networkId}
                      className="min-w-0 max-w-full truncate rounded-2xl bg-white/10 px-3 py-2 text-xs font-black text-white/70"
                    >
                      {networkNamesById.get(networkId) ?? shortId(networkId)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs font-bold text-white/40">
                    {copy.profile.noNetworks}
                  </span>
                )}
              </div>
              <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto]">
                <GlassSelect
                  ariaLabel={copy.profile.availableNetwork}
                  className="min-w-0"
                  disabled={nodeNetworkOptions.length === 0}
                  onChange={setNetworkToAdd}
                  options={
                    nodeNetworkOptions.length > 0
                      ? nodeNetworkOptions
                      : [
                          {
                            disabled: true,
                            label: copy.profile.noAvailableNetworks,
                            value: '',
                          },
                        ]
                  }
                  value={networkToAdd}
                />
                <button
                  type="button"
                  onClick={addNetwork}
                  disabled={!networkToAdd || nodeNetworkOptions.length === 0}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {copy.profile.addNetwork}
                </button>
              </div>
            </section>
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              <button
                type="button"
                onClick={() => setPasswordSectionOpen((isOpen) => !isOpen)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-black text-white/75 transition hover:bg-white/5"
                aria-expanded={passwordSectionOpen}
              >
                <span>{copy.profile.changePassword}</span>
                <span
                  aria-hidden="true"
                  className={cx(
                    'text-white/45 transition-transform',
                    passwordSectionOpen && 'rotate-180',
                  )}
                >
                  ⌄
                </span>
              </button>
              {passwordSectionOpen && (
                <div className="border-t border-white/10 p-4">
                  <p className="text-xs font-bold text-white/45">
                    {copy.profile.newPasswordHelp}
                  </p>
                  <div className="mt-4 grid gap-3">
                    <ProfileInput
                      label={copy.profile.newPassword}
                      value={newPassword}
                      onChange={setNewPassword}
                      placeholder="••••••••••••"
                      type="password"
                    />
                    <ProfileInput
                      label={copy.profile.newPasswordConfirm}
                      value={newPasswordConfirmation}
                      onChange={setNewPasswordConfirmation}
                      placeholder="••••••••••••"
                      type="password"
                    />
                  </div>
                  <PasswordChecklist
                    checks={{
                      ...passwordChecks,
                      match: passwordsMatch,
                    }}
                  />
                </div>
              )}
            </section>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <button
          disabled={!canSubmit}
          className="mt-5 w-full rounded-2xl bg-fuchsia-500 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {state === 'loading' ? copy.profile.saving : copy.profile.save}
        </button>
      </form>
      {imageEditor && (
        <Suspense fallback={null}>
          <ImageCropEditor
            file={imageEditor.file}
            shape={imageEditor.shape}
            onClose={() => setImageEditor(null)}
            onApply={(file, previewUrl) => {
              if (imageEditor.shape === 'avatar') {
                setPictureFile(file);
                setPicturePreview(previewUrl);
              } else {
                setBannerFile(file);
                setBannerPreview(previewUrl);
              }
            }}
          />
        </Suspense>
      )}
    </div>,
    document.body,
  );
}

function ProfileInput({
  label,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-black text-white/70">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-normal text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
      />
    </label>
  );
}

function ProfileEditorField({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-black uppercase tracking-[0.16em] text-white/40">
      {label}
      {children}
    </label>
  );
}

function PasswordChecklist({
  checks,
}: {
  checks: {
    lowercase: boolean;
    match: boolean;
    maxLength: boolean;
    minLength: boolean;
    number: boolean;
    symbol: boolean;
    uppercase: boolean;
  };
}) {
  const items = [
    [copy.profile.passwordRequirements.minLength, checks.minLength],
    [copy.profile.passwordRequirements.maxLength, checks.maxLength],
    [copy.profile.passwordRequirements.uppercase, checks.uppercase],
    [copy.profile.passwordRequirements.lowercase, checks.lowercase],
    [copy.profile.passwordRequirements.number, checks.number],
    [copy.profile.passwordRequirements.symbol, checks.symbol],
    [copy.profile.passwordRequirements.match, checks.match],
  ] as const;

  return (
    <div className="mt-4 grid grid-cols-1 gap-2 text-xs font-black sm:grid-cols-2">
      {items.map(([label, complete]) => (
        <div
          key={label}
          className={cx(
            'flex items-center gap-2 rounded-2xl px-3 py-2',
            complete
              ? 'bg-emerald-400/10 text-emerald-200'
              : 'bg-white/5 text-white/45',
          )}
        >
          <span aria-hidden="true">{complete ? '✓' : '×'}</span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
