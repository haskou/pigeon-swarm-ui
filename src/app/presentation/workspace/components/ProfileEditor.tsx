import {
  ChangeEvent,
  FormEvent,
  lazy,
  type ReactNode,
  type RefObject,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { DeviceUnlockMethod } from '../../../../contexts/identities/infrastructure/storage/DeviceUnlockMethod';
import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';

import {
  IDENTITY_PROFILE_BIOGRAPHY_MAX_LENGTH,
  IDENTITY_PROFILE_HANDLE_MAX_LENGTH,
  IDENTITY_PROFILE_NAME_MAX_LENGTH,
} from '../../../../contexts/identities/domain/profile/IdentityProfileConstraints';
import { admissionRetryLabel } from '../../../../contexts/identities/presentation/admissionRetryLabel';
import { AuthSwitch } from '../../../../contexts/identities/presentation/auth/AuthSecurityControls';
import {
  isValidPassword,
  passwordValidationChecks,
} from '../../../../contexts/identities/presentation/auth/credentialsValidation';
import { PasswordRequirementProgress } from '../../../../contexts/identities/presentation/auth/PasswordRequirementProgress';
import {
  isValidHandle,
  normalizeHandle,
  profilePictureUrl,
  publicFileObjectUrl,
  type IdentityNames,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { GlassSelect } from '../../../../shared/presentation/components/glassSelect';
import { SettingsNavigation } from '../../../../shared/presentation/components/SettingsNavigation';
import { cx } from '../../../../shared/presentation/cx';
import { shortId } from '../../../../shared/presentation/formatting';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { useTechnicalDetailsPreference } from '../../../../shared/presentation/preferences/useTechnicalDetailsPreference';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';
import { DeviceManagementDialog } from './DeviceManagementDialog';
import { DevicePairingDialog } from './DevicePairingDialog';
import { DeviceStorageSection } from './DeviceStorageSection';
import { profileEditorInputClass, ProfileInput } from './ProfileInput';
import { ProfilePasskeyUnlock } from './ProfilePasskeyUnlock';
import { SecurityAuditSection } from './SecurityAuditSection';

const ImageCropEditor = lazy(() =>
  import('../../../../shared/presentation/components/ImageCropEditor').then(
    (module) => ({
      default: module.ImageCropEditor,
    }),
  ),
);

type ProfileEditorSection = 'networks' | 'profile' | 'security';

function optionalTrimmed(value: string | null | undefined): string | undefined {
  return value?.trim() || undefined;
}

function sameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;

  return left.every((value, index) => value === right[index]);
}

function passwordChangeState(
  newPassword: string,
  newPasswordConfirmation: string,
  currentPassword: string,
): {
  canChangePassword: boolean;
  passwordsMatch: boolean;
  wantsPasswordChange: boolean;
} {
  const wantsPasswordChange =
    newPassword.length > 0 || newPasswordConfirmation.length > 0;
  const passwordsMatch =
    newPassword.length > 0 && newPassword === newPasswordConfirmation;
  const canChangePassword =
    !wantsPasswordChange ||
    (isValidPassword(newPassword) &&
      passwordsMatch &&
      currentPassword.trim().length > 0);

  return { canChangePassword, passwordsMatch, wantsPasswordChange };
}

function hasRemoteProfileChanges(
  session: Session,
  draft: {
    bannerFile: File | null;
    biography: string;
    identityNetworkIds: string[];
    name: string;
    normalizedHandle: string | undefined;
    pictureFile: File | null;
  },
): boolean {
  const profile = session.identity.profile;

  return (
    draft.name.trim() !== profile.name.trim() ||
    (draft.normalizedHandle ?? '') !== (profile.handle ?? '') ||
    optionalTrimmed(draft.biography) !== optionalTrimmed(profile.biography) ||
    draft.pictureFile !== null ||
    draft.bannerFile !== null ||
    !sameStringArray(draft.identityNetworkIds, session.identity.networks)
  );
}

function isProfileDraftValid(
  name: string,
  identityNetworkIds: string[],
  normalizedHandle: string | undefined,
  canChangePassword: boolean,
): boolean {
  return (
    canChangePassword &&
    name.trim().length > 0 &&
    identityNetworkIds.length > 0 &&
    (!normalizedHandle || isValidHandle(normalizedHandle))
  );
}

async function resolveImageCid(
  session: Session,
  file: File | null,
  currentCid: string | null | undefined,
): Promise<string | undefined> {
  if (!file) return optionalTrimmed(currentCid);

  return (await applicationContainer.attachments.uploadPublic(session, file))
    .cid;
}

async function saveProfileChanges(
  session: Session,
  draft: {
    bannerFile: File | null;
    biography: string;
    identityNetworkIds: string[];
    name: string;
    normalizedHandle: string | undefined;
    pictureFile: File | null;
  },
): Promise<Session['identity']> {
  const pictureCid = await resolveImageCid(
    session,
    draft.pictureFile,
    session.identity.profile.picture,
  );
  const bannerCid = await resolveImageCid(
    session,
    draft.bannerFile,
    session.identity.profile.banner,
  );

  return applicationContainer.identities.updateProfile(
    session,
    {
      banner: bannerCid,
      biography: optionalTrimmed(draft.biography),
      handle: draft.normalizedHandle,
      name: draft.name.trim(),
      networks: draft.identityNetworkIds,
      picture: pictureCid,
    },
    undefined,
    {},
  );
}

function profileDraftDefaults(
  session: Session,
  currentPicture: string | null | undefined,
): {
  biography: string;
  handle: string;
  picturePreview: string | null;
} {
  const profile = session.identity.profile;

  return {
    biography: profile.biography ?? '',
    handle: profile.handle ?? '',
    picturePreview:
      currentPicture ??
      (profile.picture ? profilePictureUrl(profile.picture) : null),
  };
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
      <span className="mt-0.5">
        <AuthSwitch enabled={checked} />
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

function ProfileDetailsSection({
  bannerInputRef,
  bannerPreview,
  biography,
  handle,
  name,
  onBannerChange,
  onBiographyChange,
  onHandleChange,
  onNameChange,
  onPictureChange,
  pictureInputRef,
  picturePreview,
  session,
}: {
  bannerInputRef: RefObject<HTMLInputElement | null>;
  bannerPreview: string | null;
  biography: string;
  handle: string;
  name: string;
  onBannerChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBiographyChange: (value: string) => void;
  onHandleChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onPictureChange: (event: ChangeEvent<HTMLInputElement>) => void;
  picturePreview: string | null;
  pictureInputRef: RefObject<HTMLInputElement | null>;
  session: Session;
}) {
  return (
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
              onChange={(event) => onNameChange(event.target.value)}
              maxLength={IDENTITY_PROFILE_NAME_MAX_LENGTH}
              className={cx(profileEditorInputClass, 'text-base font-semibold')}
            />
          </ProfileEditorField>
          <ProfileEditorField label={copy.profile.handle}>
            <input
              aria-label={copy.profile.handle}
              value={handle}
              onChange={(event) =>
                onHandleChange(normalizeHandle(event.target.value))
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
              onChange={(event) => onBiographyChange(event.target.value)}
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
        onChange={onPictureChange}
        className="sr-only"
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        onChange={onBannerChange}
        className="sr-only"
        data-testid="profile-banner-input"
      />
    </div>
  );
}

function ProfileNetworksSection({
  identityNetworkIds,
  networkNamesById,
  networkToAdd,
  nodeNetworkOptions,
  onAddNetwork,
  onNetworkToAddChange,
}: {
  identityNetworkIds: string[];
  networkNamesById: Map<string, string>;
  networkToAdd: string;
  nodeNetworkOptions: { label: string; value: string }[];
  onAddNetwork: () => void;
  onNetworkToAddChange: (value: string) => void;
}) {
  return (
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
              {networkNamesById.get(networkId) ?? shortId(networkId)}
            </span>
          ))
        ) : (
          <span className="text-xs font-bold text-white/40">
            {copy.profile.noNetworks}
          </span>
        )}
      </div>
      {nodeNetworkOptions.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <GlassSelect
            ariaLabel={copy.profile.availableNetwork}
            className="min-w-0"
            onChange={onNetworkToAddChange}
            options={nodeNetworkOptions}
            value={networkToAdd}
          />
          <button
            type="button"
            onClick={onAddNetwork}
            disabled={!networkToAdd}
            className="ui-button"
          >
            {copy.profile.addNetwork}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs font-semibold text-white/45">
          {copy.profile.noAvailableNetworks}
        </p>
      )}
    </section>
  );
}

function ProfilePasswordSection({
  currentPassword,
  newPassword,
  newPasswordConfirmation,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onNewPasswordConfirmationChange,
  onToggle,
  open,
  passwordsMatch,
}: {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirmation: string;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onNewPasswordConfirmationChange: (value: string) => void;
  onToggle: () => void;
  open: boolean;
  passwordsMatch: boolean;
}) {
  const passwordChecks = passwordValidationChecks(newPassword);

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-black text-white/75 transition hover:bg-white/5"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block">{copy.profile.changePassword}</span>
          <span className="mt-1 block text-xs font-bold text-white/40">
            {copy.profile.newPasswordHelp}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={cx(
            'text-white/45 transition-transform',
            open && 'rotate-180',
          )}
        >
          ⌄
        </span>
      </button>
      {open && (
        <div className="border-t border-white/[0.06] px-4 pb-5 pt-4">
          <p className="text-xs font-bold text-white/45">
            {copy.profile.newPasswordHelp}
          </p>
          <div className="mt-4 grid gap-3">
            <ProfileInput
              label={copy.profile.currentPassword}
              value={currentPassword}
              onChange={onCurrentPasswordChange}
              placeholder="••••••••••••"
              type="password"
            />
            <ProfileInput
              label={copy.profile.newPassword}
              value={newPassword}
              onChange={onNewPasswordChange}
              placeholder="••••••••••••"
              type="password"
            />
            <ProfileInput
              label={copy.profile.newPasswordConfirm}
              value={newPasswordConfirmation}
              onChange={onNewPasswordConfirmationChange}
              placeholder="••••••••••••"
              type="password"
            />
          </div>
          <PasswordRequirementProgress
            className="mt-4"
            checks={{
              ...passwordChecks,
              match: passwordsMatch,
            }}
          />
        </div>
      )}
    </>
  );
}

function ProfileSecuritySection({
  communities,
  conversations,
  currentPassword,
  identityNames,
  identityProfiles,
  newPassword,
  newPasswordConfirmation,
  onCurrentPasswordChange,
  onManageDevices,
  onNewPasswordChange,
  onNewPasswordConfirmationChange,
  onPairDevice,
  onTogglePassword,
  onToggleTechnicalDetails,
  passwordOpen,
  passwordsMatch,
  session,
  technicalDetailsVisible,
}: {
  communities: Community[];
  conversations: ConversationResource[];
  currentPassword: string;
  identityNames: IdentityNames;
  identityProfiles: Record<string, IdentityResource>;
  newPassword: string;
  newPasswordConfirmation: string;
  onCurrentPasswordChange: (value: string) => void;
  onManageDevices: () => void;
  onNewPasswordChange: (value: string) => void;
  onNewPasswordConfirmationChange: (value: string) => void;
  onPairDevice: () => void;
  onToggleTechnicalDetails: () => void;
  onTogglePassword: () => void;
  passwordOpen: boolean;
  passwordsMatch: boolean;
  session: Session;
  technicalDetailsVisible: boolean;
}) {
  const [unlockMethod, setUnlockMethod] = useState<DeviceUnlockMethod>();

  return (
    <>
      <section className="ui-section">
        <div className="border-b border-white/[0.06] px-4 py-3 text-sm font-black text-white/70">
          {copy.profile.security}
        </div>
        {unlockMethod !== 'passkey' && (
          <ProfilePasswordSection
            currentPassword={currentPassword}
            newPassword={newPassword}
            newPasswordConfirmation={newPasswordConfirmation}
            onCurrentPasswordChange={onCurrentPasswordChange}
            onNewPasswordChange={onNewPasswordChange}
            onNewPasswordConfirmationChange={onNewPasswordConfirmationChange}
            onToggle={onTogglePassword}
            open={passwordOpen}
            passwordsMatch={passwordsMatch}
          />
        )}
        <ProfilePasskeyUnlock
          onMethodChange={setUnlockMethod}
          session={session}
        />
        <div className="border-t border-white/[0.06] px-4 py-4">
          <button
            className="ui-button w-full"
            data-testid="profile-pair-device"
            onClick={onPairDevice}
            type="button"
          >
            {copy.profile.devicePairingAction}
          </button>
          <button
            className="ui-button mt-2 w-full"
            data-testid="profile-manage-devices"
            onClick={onManageDevices}
            type="button"
          >
            {copy.profile.deviceManageAction}
          </button>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-white/45">
            {copy.profile.devicePairingHelp}
          </p>
        </div>
        <div className="border-t border-white/[0.06] px-4 py-4">
          <ProfileSwitchButton
            checked={technicalDetailsVisible}
            disabled={false}
            help={copy.profile.technicalDetailsHelp}
            label={copy.profile.technicalDetails}
            onClick={onToggleTechnicalDetails}
          />
          <p className="mt-2 text-xs font-semibold leading-relaxed text-amber-200/70">
            {copy.profile.technicalDetailsWarning}
          </p>
        </div>
      </section>
      <DeviceStorageSection />
      <SecurityAuditSection
        communities={communities}
        conversations={conversations}
        identityNames={identityNames}
        identityProfiles={identityProfiles}
        session={session}
      />
    </>
  );
}

function ProfileEditorOverlays({
  deviceManagementOpen,
  devicePairingOpen,
  discardConfirmOpen,
  imageEditor,
  onApplyImage,
  onCancelDiscard,
  onCloseDeviceManagement,
  onCloseDevicePairing,
  onCloseImageEditor,
  onDiscard,
  onSessionUpdated,
  pairedSession,
  session,
}: {
  deviceManagementOpen: boolean;
  devicePairingOpen: boolean;
  discardConfirmOpen: boolean;
  imageEditor: { file: File; shape: 'avatar' | 'banner' } | null;
  onApplyImage: (
    shape: 'avatar' | 'banner',
    file: File,
    previewUrl: string,
  ) => void;
  onCancelDiscard: () => void;
  onCloseDeviceManagement: () => void;
  onCloseDevicePairing: () => void;
  onCloseImageEditor: () => void;
  onDiscard: () => void;
  onSessionUpdated: (session: Session) => void;
  pairedSession: Session | null;
  session: Session;
}) {
  return (
    <>
      {discardConfirmOpen && (
        <DiscardProfileChangesDialog
          onCancel={onCancelDiscard}
          onDiscard={onDiscard}
        />
      )}
      {imageEditor && (
        <Suspense fallback={null}>
          <ImageCropEditor
            file={imageEditor.file}
            shape={imageEditor.shape}
            onClose={onCloseImageEditor}
            onApply={(file, previewUrl) =>
              onApplyImage(imageEditor.shape, file, previewUrl)
            }
          />
        </Suspense>
      )}
      {deviceManagementOpen && (
        <DeviceManagementDialog
          onClose={onCloseDeviceManagement}
          onSessionUpdated={onSessionUpdated}
          session={pairedSession ?? session}
        />
      )}
      {devicePairingOpen && (
        <DevicePairingDialog
          onClose={onCloseDevicePairing}
          onSessionUpdated={onSessionUpdated}
          session={session}
        />
      )}
    </>
  );
}

function ProfileEditorError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div className="ui-inline-notice mt-4 border-rose-300/50 bg-rose-500/10 text-rose-100">
      {message}
    </div>
  );
}

function ProfileSaveFooter({
  admissionNotice,
  canSubmit,
  saving,
}: {
  admissionNotice: string | null;
  canSubmit: boolean;
  saving: boolean;
}) {
  return (
    <div className="flex shrink-0 justify-end border-t border-white/[0.06] px-5 py-4">
      <button
        disabled={!canSubmit}
        className="ui-button ui-button-primary px-5"
        data-testid="profile-save-button"
      >
        {saving ? (admissionNotice ?? copy.profile.saving) : copy.profile.save}
      </button>
    </div>
  );
}

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
  const defaults = profileDraftDefaults(session, currentPicture);
  const [name, setName] = useState(session.identity.profile.name);
  const [handle, setHandle] = useState(defaults.handle);
  const [biography, setBiography] = useState(defaults.biography);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordSectionOpen, setPasswordSectionOpen] = useState(false);
  const [devicePairingOpen, setDevicePairingOpen] = useState(false);
  const [deviceManagementOpen, setDeviceManagementOpen] = useState(false);
  const [pairedSession, setPairedSession] = useState<Session | null>(null);
  const [activeSection, setActiveSection] =
    useState<ProfileEditorSection>('profile');
  const [technicalDetailsVisible, setTechnicalDetailsVisible] =
    useTechnicalDetailsPreference();
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [identityNetworkIds, setIdentityNetworkIds] = useState(
    session.identity.networks,
  );
  const [networkToAdd, setNetworkToAdd] = useState('');
  const [picturePreview, setPicturePreview] = useState(defaults.picturePreview);
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
  const [admissionNotice, setAdmissionNotice] = useState<string | null>(null);
  const normalizedHandle = handle.trim() ? normalizeHandle(handle) : undefined;
  const { canChangePassword, passwordsMatch, wantsPasswordChange } =
    passwordChangeState(newPassword, newPasswordConfirmation, currentPassword);
  const hasRemoteChanges = hasRemoteProfileChanges(session, {
    bannerFile,
    biography,
    identityNetworkIds,
    name,
    normalizedHandle,
    pictureFile,
  });
  const hasChanges = hasRemoteChanges || wantsPasswordChange;
  const canSubmit =
    hasChanges &&
    state !== 'loading' &&
    isProfileDraftValid(
      name,
      identityNetworkIds,
      normalizedHandle,
      canChangePassword,
    );
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

  const requestClose = () => {
    if (state === 'loading') return;

    if (hasChanges) {
      setDiscardConfirmOpen(true);

      return;
    }

    close();
  };

  const handleEscape = () => {
    if (discardConfirmOpen) {
      setDiscardConfirmOpen(false);

      return;
    }

    requestClose();
  };

  useCloseOnEscape(handleEscape);

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

    void applicationContainer.attachments
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

    // Clearing the input lets the same file be picked again.
    if (pictureInputRef.current) pictureInputRef.current.value = '';

    if (file) setImageEditor({ file, shape: 'avatar' });
  };

  const handleBannerChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    // Clearing the input lets the same file be picked again.
    if (bannerInputRef.current) bannerInputRef.current.value = '';

    if (file) setImageEditor({ file, shape: 'banner' });
  };

  const applyImageEdit = (
    shape: 'avatar' | 'banner',
    file: File,
    previewUrl: string,
  ) => {
    if (shape === 'avatar') {
      setPictureFile(file);
      setPicturePreview(previewUrl);

      return;
    }

    setBannerFile(file);
    setBannerPreview(previewUrl);
  };

  const notifyPairedSession = () => {
    if (pairedSession) {
      onUpdated(pairedSession, { passwordChanged: false });
    }
  };

  const closeDeviceManagement = () => {
    setDeviceManagementOpen(false);
    notifyPairedSession();
  };

  const closeDevicePairing = () => {
    setDevicePairingOpen(false);
    notifyPairedSession();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!canSubmit) return;

    setState('loading');
    setError(null);
    const stopAdmissionProgress =
      applicationContainer.identities.watchAdmissionProgress((progress) =>
        setAdmissionNotice(admissionRetryLabel(progress)),
      );

    try {
      let identity = session.identity;

      if (hasRemoteChanges) {
        identity = await saveProfileChanges(session, {
          bannerFile,
          biography,
          identityNetworkIds,
          name,
          normalizedHandle,
          pictureFile,
        });
      }

      if (wantsPasswordChange) {
        await applicationContainer.identities.changePassword(
          session,
          currentPassword,
          newPassword,
        );
      }

      onUpdated(
        { ...session, identity },
        { passwordChanged: wantsPasswordChange },
      );
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.profile.updateError));
    } finally {
      stopAdmissionProgress();
      setAdmissionNotice(null);
    }
    setState('idle');
  };

  const sections: ReadonlyArray<readonly [ProfileEditorSection, string]> = [
    ['profile', copy.profile.profileTab],
    ['networks', copy.profile.networksTab],
    ['security', copy.profile.securityTab],
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
                <ProfileDetailsSection
                  bannerInputRef={bannerInputRef}
                  bannerPreview={bannerPreview}
                  biography={biography}
                  handle={handle}
                  name={name}
                  onBannerChange={handleBannerChange}
                  onBiographyChange={setBiography}
                  onHandleChange={setHandle}
                  onNameChange={setName}
                  onPictureChange={handlePictureChange}
                  picturePreview={picturePreview}
                  pictureInputRef={pictureInputRef}
                  session={session}
                />
              )}
              <div className="grid min-w-0 gap-3">
                {activeSection === 'networks' && (
                  <ProfileNetworksSection
                    identityNetworkIds={identityNetworkIds}
                    networkNamesById={networkNamesById}
                    networkToAdd={networkToAdd}
                    nodeNetworkOptions={nodeNetworkOptions}
                    onAddNetwork={addNetwork}
                    onNetworkToAddChange={setNetworkToAdd}
                  />
                )}
                {activeSection === 'security' && (
                  <ProfileSecuritySection
                    communities={communities}
                    conversations={conversations}
                    currentPassword={currentPassword}
                    identityNames={identityNames}
                    identityProfiles={identityProfiles}
                    newPassword={newPassword}
                    newPasswordConfirmation={newPasswordConfirmation}
                    onCurrentPasswordChange={setCurrentPassword}
                    onManageDevices={() => setDeviceManagementOpen(true)}
                    onNewPasswordChange={setNewPassword}
                    onNewPasswordConfirmationChange={setNewPasswordConfirmation}
                    onPairDevice={() => setDevicePairingOpen(true)}
                    onToggleTechnicalDetails={() =>
                      setTechnicalDetailsVisible(!technicalDetailsVisible)
                    }
                    onTogglePassword={() =>
                      setPasswordSectionOpen((isOpen) => !isOpen)
                    }
                    passwordOpen={passwordSectionOpen}
                    passwordsMatch={passwordsMatch}
                    session={session}
                    technicalDetailsVisible={technicalDetailsVisible}
                  />
                )}
              </div>

              <ProfileEditorError message={error} />
            </div>
          </div>
        </div>

        <ProfileSaveFooter
          admissionNotice={admissionNotice}
          canSubmit={canSubmit}
          saving={state === 'loading'}
        />
      </form>
      <ProfileEditorOverlays
        deviceManagementOpen={deviceManagementOpen}
        devicePairingOpen={devicePairingOpen}
        discardConfirmOpen={discardConfirmOpen}
        imageEditor={imageEditor}
        onApplyImage={applyImageEdit}
        onCancelDiscard={() => setDiscardConfirmOpen(false)}
        onCloseDeviceManagement={closeDeviceManagement}
        onCloseDevicePairing={closeDevicePairing}
        onCloseImageEditor={() => setImageEditor(null)}
        onDiscard={onClose}
        onSessionUpdated={setPairedSession}
        pairedSession={pairedSession}
        session={session}
      />
    </div>,
    document.body,
  );
}
