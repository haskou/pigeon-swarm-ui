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

import type { NodeNetwork } from '../../../../contexts/networks/application/list-node-networks/ListNodeNetworks';
import type {
  Community,
  ConversationResource,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../composition/applicationContainer';
import {
  IDENTITY_PROFILE_BIOGRAPHY_MAX_LENGTH,
  IDENTITY_PROFILE_HANDLE_MAX_LENGTH,
  IDENTITY_PROFILE_NAME_MAX_LENGTH,
} from '../../../../contexts/identities/domain/profile/IdentityProfileConstraints';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import {
  isValidPassword,
  passwordValidationChecks,
} from '../../../../contexts/identities/presentation/auth/credentialsValidation';
import { WebAuthnPrfKeyProtector } from '../../../../contexts/identities/infrastructure/crypto/WebAuthnPrfKeyProtector';
import { loadLocalPasskeyUnlock } from '../../../../contexts/identities/infrastructure/storage/localPasskeyUnlock';
import { RecoveryKey } from '../../../../contexts/identities/domain/value-objects/RecoveryKey';
import {
  conversationTitle,
  shortId,
} from '../../../../shared/presentation/formatting';
import {
  isValidHandle,
  normalizeHandle,
  profilePictureUrl,
  publicFileObjectUrl,
  type IdentityNames,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { GlassSelect } from '../../../../shared/presentation/components/glassSelect';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { SettingsNavigation } from '../../../../shared/presentation/components/SettingsNavigation';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';

const ImageCropEditor = lazy(() =>
  import('../../../../shared/presentation/components/ImageCropEditor').then(
    (module) => ({
      default: module.ImageCropEditor,
    }),
  ),
);

const profileEditorInputClass =
  'ui-field-control px-4 py-3 placeholder:text-white/30';

type ProfileEditorSection = 'keychain' | 'networks' | 'profile' | 'security';

export function ProfileEditor({
  communities = [],
  conversations = [],
  currentPicture,
  identityNames = {},
  identityProfiles = {},
  nodeNetworks,
  onClose,
  onUpdated,
  session,
}: {
  communities?: Community[];
  conversations?: ConversationResource[];
  currentPicture?: string | null;
  identityNames?: IdentityNames;
  identityProfiles?: Record<string, IdentityResource>;
  nodeNetworks: NodeNetwork[];
  session: Session;
  onClose: () => void;
  onUpdated: (session: Session, change: { passwordChanged: boolean }) => void;
}) {
  const [name, setName] = useState(session.identity.profile.name);
  const [handle, setHandle] = useState(session.identity.profile.handle ?? '');
  const [biography, setBiography] = useState(
    session.identity.profile.biography ?? '',
  );
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [passwordRecoveryKey, setPasswordRecoveryKey] = useState('');
  const [currentPasswordForPasskey, setCurrentPasswordForPasskey] =
    useState('');
  const [passwordSectionOpen, setPasswordSectionOpen] = useState(false);
  const hasPasskeyPrf = !!session.identity.masterKeyDerivation.passkeyPrf;
  const hasRecoveryKey = !!session.identity.masterKeyDerivation.recoveryKey;
  const [passkeyPrfEnabled, setPasskeyPrfEnabled] = useState(hasPasskeyPrf);
  const [initialLocalPasskeyPrfEnabled] = useState(
    () => !!loadLocalPasskeyUnlock(session.identity.id),
  );
  const [localPasskeyPrfEnabled, setLocalPasskeyPrfEnabled] = useState(
    initialLocalPasskeyPrfEnabled,
  );
  const [passkeyPrfAvailable, setPasskeyPrfAvailable] = useState(false);
  const [activeSection, setActiveSection] =
    useState<ProfileEditorSection>('profile');
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
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
  const { close, state: transitionState } = useCloseTransition(onClose);
  const [error, setError] = useState<string | null>(null);
  const normalizedHandle = handle.trim() ? normalizeHandle(handle) : undefined;
  const wantsPasswordChange =
    newPassword.length > 0 || newPasswordConfirmation.length > 0;
  const passwordChecks = passwordValidationChecks(newPassword);
  const passwordsMatch =
    newPassword.length > 0 && newPassword === newPasswordConfirmation;
  const passkeyPrfChanged = passkeyPrfEnabled !== hasPasskeyPrf;
  const localPasskeyPrfChanged =
    localPasskeyPrfEnabled !== initialLocalPasskeyPrfEnabled;
  const deviceUnlockEnabled = passkeyPrfEnabled || localPasskeyPrfEnabled;
  const hasSavedDeviceUnlock = hasPasskeyPrf || initialLocalPasskeyPrfEnabled;
  const canEnableDeviceUnlock = passkeyPrfAvailable || hasSavedDeviceUnlock;
  const shouldRefreshLocalPasskeyPrf =
    localPasskeyPrfEnabled && wantsPasswordChange;
  const shouldConfigureLocalPasskeyPrf =
    localPasskeyPrfChanged || shouldRefreshLocalPasskeyPrf;
  const needsCurrentPasswordForPasskey =
    !wantsPasswordChange &&
    (passkeyPrfChanged || (localPasskeyPrfChanged && localPasskeyPrfEnabled));
  const needsRecoveryKeyForPasskey =
    needsCurrentPasswordForPasskey && hasRecoveryKey;
  const canChangePassword =
    !wantsPasswordChange ||
    (isValidPassword(newPassword) &&
      passwordsMatch &&
      (!hasRecoveryKey || RecoveryKey.isValid(passwordRecoveryKey)));
  const canUpdatePasskeyPrf =
    !passkeyPrfChanged ||
    ((!passkeyPrfEnabled || passkeyPrfAvailable) &&
      (wantsPasswordChange ||
        (currentPasswordForPasskey.trim().length > 0 &&
          (!needsRecoveryKeyForPasskey ||
            RecoveryKey.isValid(passwordRecoveryKey)))));
  const canUpdateLocalPasskeyPrf =
    !shouldConfigureLocalPasskeyPrf ||
    !localPasskeyPrfEnabled ||
    (passkeyPrfAvailable &&
      (wantsPasswordChange ||
        (currentPasswordForPasskey.trim().length > 0 &&
          (!needsRecoveryKeyForPasskey ||
            RecoveryKey.isValid(passwordRecoveryKey)))));
  const profileChanged =
    name.trim() !== session.identity.profile.name.trim() ||
    (normalizedHandle ?? '') !== (session.identity.profile.handle ?? '') ||
    (biography.trim() || undefined) !==
      (session.identity.profile.biography?.trim() || undefined);
  const mediaChanged = pictureFile !== null || bannerFile !== null;
  const networksChanged = !sameStringArray(
    identityNetworkIds,
    session.identity.networks,
  );
  const hasRemoteChanges =
    profileChanged ||
    mediaChanged ||
    networksChanged ||
    wantsPasswordChange ||
    passkeyPrfChanged;
  const hasChanges = hasRemoteChanges || localPasskeyPrfChanged;
  const canSubmit =
    hasChanges &&
    name.trim().length > 0 &&
    identityNetworkIds.length > 0 &&
    (!normalizedHandle || isValidHandle(normalizedHandle)) &&
    canChangePassword &&
    canUpdatePasskeyPrf &&
    canUpdateLocalPasskeyPrf &&
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
    let mounted = true;

    WebAuthnPrfKeyProtector.isPrfAvailable()
      .then((available) => {
        if (mounted) setPasskeyPrfAvailable(available);
      })
      .catch(() => {
        if (mounted) setPasskeyPrfAvailable(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const requestClose = () => {
    if (state === 'loading') return;

    if (hasChanges) {
      setDiscardConfirmOpen(true);

      return;
    }

    close();
  };

  useCloseOnEscape(
    discardConfirmOpen ? () => setDiscardConfirmOpen(false) : requestClose,
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

    void applicationContainer
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

  const toggleDeviceUnlock = () => {
    if (deviceUnlockEnabled) {
      setPasskeyPrfEnabled(false);
      setLocalPasskeyPrfEnabled(false);

      return;
    }

    if (!canEnableDeviceUnlock) return;

    setPasskeyPrfEnabled(passkeyPrfAvailable || hasPasskeyPrf);
    setLocalPasskeyPrfEnabled(initialLocalPasskeyPrfEnabled);
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
      let identity = session.identity;

      if (hasRemoteChanges) {
        const pictureCid = pictureFile
          ? (await applicationContainer.uploadPublicFile(session, pictureFile))
              .cid
          : session.identity.profile.picture?.trim() || undefined;
        const bannerCid = bannerFile
          ? (await applicationContainer.uploadPublicFile(session, bannerFile))
              .cid
          : session.identity.profile.banner?.trim() || undefined;

        identity = await applicationContainer.updateIdentityProfile(
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
          {
            currentPassword:
              passkeyPrfChanged && !wantsPasswordChange
                ? currentPasswordForPasskey
                : undefined,
            passkeyPrfEnabled: passkeyPrfChanged
              ? passkeyPrfEnabled
              : undefined,
            recoveryKey: hasRecoveryKey ? passwordRecoveryKey : undefined,
          },
        );
      }

      if (shouldConfigureLocalPasskeyPrf) {
        await applicationContainer.configureLocalPasskeyUnlock(
          { ...session, identity },
          wantsPasswordChange ? newPassword : currentPasswordForPasskey,
          localPasskeyPrfEnabled,
          localPasskeyPrfEnabled && hasRecoveryKey
            ? passwordRecoveryKey
            : undefined,
        );
      }

      onUpdated(
        { ...session, identity },
        { passwordChanged: wantsPasswordChange },
      );
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.profile.updateError));
    }
    setState('idle');
  };

  const sections: ReadonlyArray<readonly [ProfileEditorSection, string]> = [
    ['profile', copy.profile.profileTab],
    ['networks', copy.profile.networksTab],
    ['security', copy.profile.securityTab],
    ['keychain', copy.profile.keychainTab],
  ];

  return createPortal(
    <div
      className="app-overlay-scrim fixed inset-0 z-50 grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4"
      data-state={transitionState}
    >
      <button
        type="button"
        className="absolute inset-0"
        onClick={requestClose}
        aria-label={copy.dialog.close}
      />
      <form
        onSubmit={handleSubmit}
        className="app-overlay-surface app-safe-area-panel ui-dialog-surface relative z-10 flex h-[100dvh] max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden sm:h-[88vh] sm:max-h-[88vh] sm:max-w-5xl"
        data-state={transitionState}
      >
        <DialogHeader title={copy.profile.edit} onClose={requestClose} />

        <div className="ui-settings-layout">
          <SettingsNavigation
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            sections={sections}
          />
          <div className="ui-settings-content profile-editor-scroll">
            <div className="mx-auto w-full max-w-3xl">
              {activeSection === 'profile' && (
                <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-black/10">
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    className="group relative block aspect-[3/1] w-full overflow-hidden bg-gradient-to-br from-slate-900 via-fuchsia-950 to-cyan-900"
                    aria-label={copy.profile.changeBanner}
                    data-testid="profile-banner-button"
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
                  <div className="relative px-5 pb-5">
                    <button
                      type="button"
                      onClick={() => pictureInputRef.current?.click()}
                      className="group relative -mt-8 grid h-[4.75rem] w-[4.75rem] place-items-center overflow-hidden rounded-lg border-[3px] border-[#1f1f27] bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-2xl font-black text-slate-950 shadow-xl shadow-black/35"
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
                    <div className="mt-2 grid gap-3">
                      <ProfileEditorField label={copy.profile.name}>
                        <input
                          aria-label={copy.profile.name}
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          maxLength={IDENTITY_PROFILE_NAME_MAX_LENGTH}
                          className={cx(
                            profileEditorInputClass,
                            'text-base font-semibold',
                          )}
                        />
                      </ProfileEditorField>
                      <ProfileEditorField label={copy.profile.handle}>
                        <input
                          aria-label={copy.profile.handle}
                          value={handle}
                          onChange={(event) =>
                            setHandle(normalizeHandle(event.target.value))
                          }
                          maxLength={IDENTITY_PROFILE_HANDLE_MAX_LENGTH}
                          placeholder="@ada"
                          className={cx(
                            profileEditorInputClass,
                            'text-sm font-medium text-white/75',
                          )}
                        />
                      </ProfileEditorField>
                      <ProfileEditorField label={copy.profile.biography}>
                        <textarea
                          aria-label={copy.profile.biography}
                          value={biography}
                          onChange={(event) => setBiography(event.target.value)}
                          maxLength={IDENTITY_PROFILE_BIOGRAPHY_MAX_LENGTH}
                          className={cx(
                            profileEditorInputClass,
                            'min-h-[4.75rem] resize-y text-sm font-normal',
                          )}
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
                    data-testid="profile-banner-input"
                  />
                </div>
              )}
              <div className="grid min-w-0 gap-3">
                {activeSection === 'networks' && (
                  <section className="ui-section py-3">
                    <div className="text-sm font-black text-white/70">
                      {copy.profile.networks}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {identityNetworkIds.length > 0 ? (
                        identityNetworkIds.map((networkId) => (
                          <span
                            key={networkId}
                            title={networkId}
                            className="min-w-0 max-w-full truncate rounded-full border border-white/[0.06] bg-white/10 px-2.5 py-1 text-xs font-black text-white/70"
                          >
                            {networkNamesById.get(networkId) ??
                              shortId(networkId)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs font-bold text-white/40">
                          {copy.profile.noNetworks}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
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
                        disabled={
                          !networkToAdd || nodeNetworkOptions.length === 0
                        }
                        className="ui-button"
                      >
                        {copy.profile.addNetwork}
                      </button>
                    </div>
                  </section>
                )}
                {activeSection === 'security' && (
                  <section className="ui-section">
                    <div className="border-b border-white/[0.06] px-4 py-3 text-sm font-black text-white/70">
                      {copy.profile.security}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPasswordSectionOpen((isOpen) => !isOpen)
                      }
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-black text-white/75 transition hover:bg-white/5"
                      aria-expanded={passwordSectionOpen}
                    >
                      <span className="min-w-0">
                        <span className="block">
                          {copy.profile.changePassword}
                        </span>
                        <span className="mt-1 block text-xs font-bold text-white/40">
                          {hasRecoveryKey
                            ? copy.profile.passwordChangeRequiresRecoveryKey
                            : copy.profile.passwordChangePreservesPasskey}
                        </span>
                      </span>
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
                      <div className="border-t border-white/[0.06] px-4 pb-5 pt-4">
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
                          {hasRecoveryKey && (
                            <div className="ui-inline-notice border-amber-300/40 bg-amber-300/10">
                              <div className="text-xs font-black text-amber-50">
                                {copy.profile.recoveryKeyRequiredTitle}
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-amber-50/70">
                                {copy.profile.recoveryKeyRequiredHelp}
                              </p>
                              <div className="mt-3">
                                <ProfileInput
                                  label={copy.profile.recoveryKeyForPassword}
                                  value={passwordRecoveryKey}
                                  onChange={setPasswordRecoveryKey}
                                  placeholder="psrk1..."
                                  type="password"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <PasswordChecklist
                          checks={{
                            ...passwordChecks,
                            match: passwordsMatch,
                          }}
                        />
                      </div>
                    )}
                    <div className="border-t border-white/[0.06] px-4 py-4">
                      <div className="mb-3">
                        <div className="text-sm font-black text-white/75">
                          {copy.profile.localDeviceUnlockSection}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-white/45">
                          {copy.profile.localDeviceUnlockSectionHelp}
                        </p>
                      </div>
                      <ProfileSwitchButton
                        checked={deviceUnlockEnabled}
                        disabled={
                          !canEnableDeviceUnlock && !deviceUnlockEnabled
                        }
                        help={
                          deviceUnlockEnabled
                            ? copy.profile.localDeviceUnlockHelp
                            : passkeyPrfAvailable
                              ? copy.profile.localDeviceUnlockHelp
                              : copy.profile.localDeviceUnlockUnavailable
                        }
                        label={copy.profile.localDeviceUnlock}
                        onClick={toggleDeviceUnlock}
                      />
                      {needsCurrentPasswordForPasskey && (
                        <div className="mt-4 grid gap-3">
                          <ProfileInput
                            label={copy.profile.currentPassword}
                            value={currentPasswordForPasskey}
                            onChange={setCurrentPasswordForPasskey}
                            placeholder="••••••••••••"
                            type="password"
                          />
                          {needsRecoveryKeyForPasskey && (
                            <ProfileInput
                              label={copy.profile.recoveryKeyForPassword}
                              value={passwordRecoveryKey}
                              onChange={setPasswordRecoveryKey}
                              placeholder="psrk1..."
                              type="password"
                            />
                          )}
                          <p className="mt-2 text-xs leading-relaxed text-white/45">
                            {copy.profile.currentPasswordForPasskeyHelp}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                )}
                {activeSection === 'keychain' && (
                  <KeychainSection
                    communities={communities}
                    conversations={conversations}
                    identityNames={identityNames}
                    identityProfiles={identityProfiles}
                    session={session}
                  />
                )}
              </div>

              {error && (
                <div className="ui-inline-notice mt-4 border-rose-300/50 bg-rose-500/10 text-rose-100">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end border-t border-white/[0.06] px-5 py-4">
          <button
            disabled={!canSubmit}
            className="ui-button ui-button-primary px-5"
            data-testid="profile-save-button"
          >
            {state === 'loading' ? copy.profile.saving : copy.profile.save}
          </button>
        </div>
      </form>
      {discardConfirmOpen && (
        <DiscardProfileChangesDialog
          onCancel={() => setDiscardConfirmOpen(false)}
          onDiscard={onClose}
        />
      )}
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
        className={cx(profileEditorInputClass, 'text-sm font-normal')}
      />
    </label>
  );
}

function ProfileSwitchButton({
  checked,
  disabled,
  help,
  label,
  onClick,
}: {
  checked: boolean;
  disabled: boolean;
  help: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'flex w-full items-start gap-3 rounded-2xl px-1 py-2 text-left transition',
        disabled && !checked
          ? 'cursor-not-allowed opacity-55'
          : checked
            ? disabled
              ? 'cursor-default text-white'
              : 'text-white'
            : 'text-white/75 hover:bg-white/[0.04]',
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full border border-white/10 transition-colors',
          checked ? 'bg-cyan-400/25' : 'bg-black/25',
        )}
      >
        <span
          className={cx(
            'h-4 w-4 rounded-full bg-white transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-white/80">{label}</span>
        <span className="mt-1 block text-xs leading-snug text-white/45">
          {help}
        </span>
      </span>
    </button>
  );
}

function KeychainSection({
  communities,
  conversations,
  identityNames,
  identityProfiles,
  session,
}: {
  communities: Community[];
  conversations: ConversationResource[];
  identityNames: IdentityNames;
  identityProfiles: Record<string, IdentityResource>;
  session: Session;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const entries = keychainDisplayEntries({
    communities,
    conversations,
    identityNames,
    identityProfiles,
    session,
  });

  const copyValue = async (entryId: string, value: string) => {
    if (navigator.clipboard) await navigator.clipboard.writeText(value);

    setCopiedKey(entryId);
    window.setTimeout(() => setCopiedKey(null), 1600);
  };

  return (
    <section className="ui-section">
      <div className="border-b border-white/[0.06] py-3">
        <div className="text-sm font-black text-white/70">
          {copy.profile.keychainTab}
        </div>
        <p className="mt-1 text-xs font-bold leading-relaxed text-white/40">
          {copy.profile.keychainHelp}
        </p>
      </div>
      <div>
        {entries.length === 0 ? (
          <div className="py-5 text-sm font-semibold text-white/45">
            {copy.profile.noKeychainKeys}
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="ui-list-block">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white/80">
                    {entry.title}
                  </div>
                  {entry.subtitle && (
                    <div className="mt-1 truncate text-xs font-semibold text-white/40">
                      {entry.subtitle}
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-[0.65rem] font-black uppercase text-white/45">
                  {entry.algorithm}
                </span>
              </div>
              <div className="mt-3 flex min-w-0 items-center gap-2 border-t border-white/[0.06] pt-2 text-xs">
                <span className="min-w-0 flex-1 truncate font-mono text-white/45">
                  ••••••••••••••••••••••••
                </span>
                <button
                  type="button"
                  onClick={() => void copyValue(entry.id, entry.key)}
                  className="shrink-0 rounded-lg bg-white/10 px-2 py-1 font-black text-white/70 transition hover:bg-white/15 hover:text-white"
                >
                  {copiedKey === entry.id
                    ? copy.profile.copied
                    : copy.profile.copy}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

type KeychainDisplayEntry = {
  algorithm: string;
  id: string;
  key: string;
  subtitle?: string;
  title: string;
};

function keychainDisplayEntries({
  communities,
  conversations,
  identityNames,
  identityProfiles,
  session,
}: {
  communities: Community[];
  conversations: ConversationResource[];
  identityNames: IdentityNames;
  identityProfiles: Record<string, IdentityResource>;
  session: Session;
}): KeychainDisplayEntry[] {
  return [
    {
      algorithm: copy.profile.identityKeys,
      id: 'identity-master-key',
      key: session.identity.encryptedMasterKey,
      subtitle: readableIdentityName(
        session.identity.id,
        identityProfiles,
        identityNames,
      ),
      title: copy.profile.encryptedMasterKey,
    },
    {
      algorithm: copy.profile.identityKeys,
      id: 'identity-private-key',
      key: session.identity.encryptedKeyPair.encryptedPrivateKey,
      subtitle: readableIdentityName(
        session.identity.id,
        identityProfiles,
        identityNames,
      ),
      title: copy.profile.encryptedPrivateKey,
    },
    ...Object.entries(session.keychain.conversations).map(([entryId, entry]) =>
      keychainConversationDisplayEntry({
        communities,
        conversations,
        entry,
        entryId,
        identityNames,
        identityProfiles,
      }),
    ),
  ];
}

function keychainConversationDisplayEntry({
  communities,
  conversations,
  entry,
  entryId,
  identityNames,
  identityProfiles,
}: {
  communities: Community[];
  conversations: ConversationResource[];
  entry: Session['keychain']['conversations'][string];
  entryId: string;
  identityNames: IdentityNames;
  identityProfiles: Record<string, IdentityResource>;
}): KeychainDisplayEntry {
  if (entry.kind === 'community') {
    const community = communities.find(
      (candidate) =>
        candidate.id === entry.conversationId || candidate.id === entryId,
    );

    return {
      algorithm: entry.algorithm,
      id: entryId,
      key: entry.key,
      subtitle: community?.description || undefined,
      title: `${copy.profile.communityKey} · ${
        community?.name ?? shortId(entry.conversationId || entryId)
      }`,
    };
  }

  const conversation = conversations.find(
    (candidate) => candidate.id === entry.conversationId,
  );
  const peerIdentity = identityProfiles[entry.peerIdentityId];
  const peerName = readableIdentityName(
    entry.peerIdentityId,
    identityProfiles,
    identityNames,
  );
  const title =
    conversation?.name ??
    conversation?.title ??
    peerIdentity?.profile.name?.trim() ??
    (conversation
      ? conversationTitle({
          ...conversation,
          participantIdentityIds: conversation.participantIdentityIds?.map(
            (identityId) =>
              readableIdentityName(identityId, identityProfiles, identityNames),
          ),
          peerIdentityId: conversation.peerIdentityId
            ? readableIdentityName(
                conversation.peerIdentityId,
                identityProfiles,
                identityNames,
              )
            : undefined,
        })
      : shortId(entry.conversationId));

  return {
    algorithm: entry.algorithm,
    id: entryId,
    key: entry.key,
    subtitle: peerName,
    title: `${copy.profile.conversationKey} · ${title}`,
  };
}

function readableIdentityName(
  identityId: string,
  identityProfiles: Record<string, IdentityResource>,
  identityNames: IdentityNames,
): string {
  const identity = identityProfiles[identityId];
  const profileName = identity?.profile.name?.trim();
  const handle = identity?.profile.handle?.trim();
  const cachedName = identityNames[identityId]?.trim();

  if (profileName) return profileName;
  if (handle) return `@${handle}`;
  if (cachedName && cachedName !== identityId) {
    return cachedName.replace(/\s+\(@[^)]+\)$/, '');
  }

  return shortId(identityId);
}

function DiscardProfileChangesDialog({
  onCancel,
  onDiscard,
}: {
  onCancel: () => void;
  onDiscard: () => void;
}) {
  useCloseOnEscape(onCancel);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-md">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onCancel}
        aria-label={copy.dialog.close}
      />
      <section
        className="glass-panel-strong relative w-full max-w-sm rounded-2xl p-5 text-left shadow-2xl shadow-black/40"
        role="dialog"
        aria-modal="true"
        aria-label={copy.profile.discardChangesBody}
      >
        <p className="text-sm font-bold leading-6 text-white/75">
          {copy.profile.discardChangesBody}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-2xl bg-rose-500/15 px-4 py-3 text-sm font-black text-rose-100 transition hover:bg-rose-500/25"
          >
            {copy.profile.discardChanges}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-white/90"
          >
            {copy.profile.keepEditing}
          </button>
        </div>
      </section>
    </div>
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
    <label className="grid gap-1.5 text-sm font-semibold text-white/65">
      {label}
      {children}
    </label>
  );
}

function sameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;

  return left.every((value, index) => value === right[index]);
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
    <div className="mt-4 grid grid-cols-1 gap-1.5 text-xs font-black">
      {items.map(([label, complete]) => (
        <div
          key={label}
          className={cx(
            'flex min-h-8 items-center gap-2 rounded-xl px-3 py-1.5',
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
