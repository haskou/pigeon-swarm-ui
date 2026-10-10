import { FormEvent, type ReactElement, useEffect, useState } from 'react';

import type {
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { NetworkSynchronizationStatus } from '../../../networks/presentation/view-models/NetworkSynchronizationStatus';
import type { NodeNetwork } from '../../../networks/presentation/view-models/NodeNetwork';
import type { LoginIdentityProgressStep } from '../../application/login-identity/LoginIdentityProgressStep';
import type { DevicePairingRequestDraft } from '../../domain/DevicePairingRequestDraft';

import { loadApplicationContainer } from '../../../../app/composition/loadApplicationContainer';
import { SegmentedControl } from '../../../../shared/presentation/components/segmentedControl';
import { cx } from '../../../../shared/presentation/cx';
import { useInstallPrompt } from '../../../../shared/presentation/hooks/useInstallPrompt';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { DevicePairingCode } from '../../domain/value-objects/DevicePairingCode';
import { RecoveryKey } from '../../domain/value-objects/RecoveryKey';
import {
  clearLastLoginIdentity,
  loadLastLoginIdentity,
  saveLastLoginIdentity,
} from '../../infrastructure/storage/lastLoginIdentity';
import { useIdentityPreview } from '../hooks/useIdentityPreview';
import { AuthFormFields } from './AuthFormFields';
import {
  type AuthMode,
  canSubmitAuthForm,
  normalizeIdentityLogin,
  registrationNetworks,
} from './authFormRules';
import { RecoveryKeyPanel } from './AuthSecurityControls';
import {
  isValidPassword,
  normalizeHandleInput,
  passwordValidationChecks,
} from './credentialsValidation';
import { Field } from './Field';
import { LoginIdentityPreview } from './LoginIdentityPreview';
import { type LoginMethod, LoginMethodPanel } from './LoginMethodPanel';
import { NodeLoginSummary } from './NodeLoginSummary';
import { PasswordRequirementProgress } from './PasswordRequirementProgress';

type LoadState = 'idle' | 'loading' | 'error';

interface AuthScreenProps {
  availableNetworks: NodeNetwork[];
  ipfsPeerCount: number;
  networkSynchronizationStatus: NetworkSynchronizationStatus | null;
  nodeOwnerId: string | null;
  onAuthenticated: (
    session: Session,
    conversations: ConversationResource[],
  ) => void;
  peersLoading: boolean;
}

export function AuthScreen({
  availableNetworks,
  ipfsPeerCount,
  networkSynchronizationStatus,
  nodeOwnerId,
  onAuthenticated,
  peersLoading,
}: AuthScreenProps): ReactElement {
  const [mode, setMode] = useState<AuthMode>('login');
  const [identityId, setIdentityId] = useState(loadLastLoginIdentity);
  const [identityPreviewLookup, setIdentityPreviewLookup] = useState('');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [networks, setNetworks] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [recoveryKey, setRecoveryKey] = useState(() =>
    RecoveryKey.generate().valueOf(),
  );
  const [recoveryKeyConfirmed, setRecoveryKeyConfirmed] = useState(false);
  const [loginRecoveryKey, setLoginRecoveryKey] = useState('');
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password');
  const [pairingInvitationCode, setPairingInvitationCode] = useState('');
  const [pairingCompletionCode, setPairingCompletionCode] = useState('');
  const [pairingDraft, setPairingDraft] =
    useState<DevicePairingRequestDraft | null>(null);
  const [pairingVerificationCode, setPairingVerificationCode] = useState('');
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loginProgressStep, setLoginProgressStep] =
    useState<LoginIdentityProgressStep | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const { installState, requestInstall } = useInstallPrompt();
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const useRecoveryKey = mode === 'login' && loginMethod === 'recovery';
  const useDevicePairing = mode === 'login' && loginMethod === 'device';
  const loginMethodOptions = [
    { label: copy.auth.loginMethodPassword, value: 'password' },
    { label: copy.auth.loginMethodDevice, value: 'device' },
    { label: copy.auth.loginMethodRecovery, value: 'recovery' },
  ] satisfies Array<{ label: string; value: LoginMethod }>;
  const loginMethodHelp = {
    device: copy.auth.loginMethodDeviceHelp,
    password: copy.auth.loginMethodPasswordHelp,
    recovery: copy.auth.loginMethodRecoveryHelp,
  } satisfies Record<LoginMethod, string>;
  const modeOptions = [
    { label: copy.auth.login, value: 'login' },
    { label: copy.auth.createIdentityShort, value: 'create' },
  ] satisfies Array<{ label: string; value: AuthMode }>;
  const loginIdentityPreview = useIdentityPreview(
    mode === 'login' ? identityPreviewLookup || undefined : undefined,
  );

  useEffect(() => {
    if (availableNetworks.length > 0 && !selectedNetwork) {
      setSelectedNetwork(availableNetworks[0].id);
    }
  }, [availableNetworks, selectedNetwork]);

  useEffect(() => {
    const lookup = normalizeIdentityLogin(identityId);

    if (mode !== 'login' || !lookup) {
      setIdentityPreviewLookup('');

      return undefined;
    }

    setIdentityPreviewLookup('');

    const timeout = window.setTimeout(() => {
      setIdentityPreviewLookup(lookup);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [identityId, mode]);

  const ordinaryCanSubmit =
    canSubmitAuthForm({
      availableNetworkCount: availableNetworks.length,
      handle,
      identityId,
      mode,
      name,
      password,
      passwordConfirmation,
      selectedNetwork,
    }) &&
    (mode !== 'login' ||
      !useRecoveryKey ||
      RecoveryKey.isValid(loginRecoveryKey)) &&
    (mode === 'login' || recoveryKeyConfirmed);
  const passwordChecks = passwordValidationChecks(password);
  const passwordRequirementChecks = {
    ...passwordChecks,
    match: password.length > 0 && password === passwordConfirmation,
  };
  const localDevicePasswordValid =
    isValidPassword(password) && password === passwordConfirmation;
  const canSubmit = useDevicePairing
    ? Boolean(
        pairingDraft &&
        pairingCompletionCode.trim() &&
        localDevicePasswordValid,
      )
    : useRecoveryKey
      ? ordinaryCanSubmit && localDevicePasswordValid
      : ordinaryCanSubmit;
  const canShowInstallButton = installState !== 'installed';
  const installButtonDisabled =
    installState === 'checking' || installState === 'prompting';
  const installHelp =
    installState === 'ready'
      ? copy.auth.installAppReadyHelp
      : installState === 'fallback'
        ? installFallbackHelp()
        : null;
  const installButtonLabel =
    installState === 'checking'
      ? copy.auth.installAppChecking
      : installState === 'prompting'
        ? copy.auth.installAppPrompting
        : installState === 'ready'
          ? copy.auth.installApp
          : copy.auth.installAppInstructions;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!canSubmit) return;

    setState('loading');
    setError(null);
    setLoginProgressStep(mode === 'login' ? 'resolving-identity' : null);

    try {
      const applicationContainer = await loadApplicationContainer();
      const result =
        mode === 'login'
          ? useDevicePairing && pairingDraft
            ? await applicationContainer.identities.completeDevicePairing(
                normalizeIdentityLogin(identityId),
                password,
                pairingDraft,
                DevicePairingCode.fromString(pairingCompletionCode),
                setLoginProgressStep,
              )
            : useRecoveryKey
              ? await applicationContainer.identities.recover(
                  normalizeIdentityLogin(identityId),
                  password,
                  loginRecoveryKey.trim(),
                  setLoginProgressStep,
                )
              : await applicationContainer.identities.login(
                  normalizeIdentityLogin(identityId),
                  password,
                  setLoginProgressStep,
                )
          : await applicationContainer.identities.register(
              name,
              password,
              registrationNetworks({
                availableNetworkCount: availableNetworks.length,
                fallbackNetworks: networks,
                selectedNetwork,
              }),
              handle.trim() ? normalizeHandleInput(handle) : undefined,
              {
                recoveryKey,
              },
            );

      saveLastLoginIdentity(result.session.identity.id);

      onAuthenticated(result.session, result.conversations);
    } catch (caught) {
      setState('error');
      setLoginProgressStep(null);
      setError(toUserErrorMessage(caught, copy.auth.unknownError));

      return;
    }

    setLoginProgressStep(null);
    setState('idle');
  };

  const prepareDevicePairing = async () => {
    setState('loading');
    setError(null);

    try {
      const applicationContainer = await loadApplicationContainer();
      const draft =
        await applicationContainer.identities.createDevicePairingRequest(
          DevicePairingCode.fromString(pairingInvitationCode),
        );

      setPairingVerificationCode(
        await draft.getRequest().getVerificationCode(),
      );
      setPairingDraft(draft);
      setIdentityId(
        draft.getRequest().getInvitation().getIdentityId().valueOf(),
      );
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.auth.devicePairingError));
    } finally {
      setState('idle');
    }
  };

  const handleModeChange = (nextMode: AuthMode) => {
    if (state === 'loading') return;

    setMode(nextMode);
    setError(null);
    setState('idle');
    setLoginProgressStep(null);
  };

  const handleInstallApp = async () => {
    const installOutcome = await requestInstall();

    if (installOutcome === 'accepted') {
      setShowInstallHelp(false);

      return;
    }

    if (installState === 'fallback') {
      setShowInstallHelp((current) => !current);

      return;
    }

    setShowInstallHelp(true);
  };

  return (
    <section className="app-screen relative z-10 grid h-[100dvh] min-h-[100dvh] items-start justify-center overflow-y-auto overscroll-contain px-4 py-7 sm:py-10 lg:place-items-center">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_480px] lg:items-start">
        <div className="hidden lg:sticky lg:top-0 lg:block">
          <div className="glass-panel-strong rounded-2xl p-8">
            <img
              src="/logo.png"
              alt="Pigeon Swarm"
              className="floaty h-28 w-28 rounded-2xl shadow-2xl shadow-indigo-950/40"
            />
            <h1 className="mt-8 max-w-xl text-5xl font-black">
              {copy.auth.heroTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/65">
              {copy.auth.heroBody}
            </p>
            <div className="mt-8">
              <InstallAppAction
                canShowButton={canShowInstallButton}
                disabled={installButtonDisabled}
                help={installHelp}
                label={installButtonLabel}
                onClick={handleInstallApp}
                ready={installState === 'ready'}
                showHelp={showInstallHelp}
              />
            </div>
            <NodeLoginSummary
              availableNetworks={availableNetworks}
              className="mt-4"
              ipfsPeerCount={ipfsPeerCount}
              networkSynchronizationStatus={networkSynchronizationStatus}
              ownerIdentityId={nodeOwnerId}
              peersLoading={peersLoading}
            />
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-panel-strong min-h-0 rounded-2xl p-5 sm:p-7"
        >
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <img
              src="/logo.png"
              alt=""
              className="h-12 w-12 rounded-2xl shadow-lg shadow-indigo-950/30"
            />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black">{copy.auth.title}</h1>
              <p className="line-clamp-2 text-sm leading-snug text-white/55">
                {copy.auth.heroTitle}
              </p>
            </div>
          </div>

          <SegmentedControl
            value={mode}
            onChange={handleModeChange}
            options={modeOptions}
            data-testid="auth-mode-control"
          />

          <div className="mt-6 space-y-4">
            <AuthFormFields
              availableNetworks={availableNetworks}
              handle={handle}
              identityId={identityId}
              identitySelected={Boolean(loginIdentityPreview.identity)}
              mode={mode}
              name={name}
              networks={networks}
              selectedNetwork={selectedNetwork}
              onHandleChange={setHandle}
              onIdentityIdChange={setIdentityId}
              onNameChange={setName}
              onNetworksChange={setNetworks}
              onSelectedNetworkChange={setSelectedNetwork}
            />

            {mode === 'login' && loginIdentityPreview.identity ? (
              <LoginIdentityPreview
                onClear={() => {
                  clearLastLoginIdentity();
                  setIdentityId('');
                  setIdentityPreviewLookup('');
                }}
                preview={loginIdentityPreview}
              />
            ) : null}

            {mode === 'login' && (
              <div className="grid gap-2">
                <SegmentedControl
                  columns={3}
                  dense
                  value={loginMethod}
                  onChange={setLoginMethod}
                  options={loginMethodOptions}
                  data-testid="auth-login-method-control"
                />
                <p className="px-1 text-xs leading-relaxed text-white/50">
                  {loginMethodHelp[loginMethod]}
                </p>
              </div>
            )}

            <Field
              label={
                useRecoveryKey || useDevicePairing
                  ? copy.auth.passwordNewDeviceLabel
                  : copy.auth.passwordLabel
              }
            >
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="ui-field-control px-4 py-3 text-sm placeholder:text-white/30"
                placeholder="••••••••••••"
                type="password"
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                data-testid="auth-password-input"
              />
            </Field>
            {mode === 'login' && (
              <>
                <LoginMethodPanel
                  completionCode={pairingCompletionCode}
                  draft={pairingDraft}
                  invitationCode={pairingInvitationCode}
                  loading={state === 'loading'}
                  method={loginMethod}
                  onCompletionCodeChange={setPairingCompletionCode}
                  onInvitationCodeChange={(value) => {
                    setPairingInvitationCode(value);
                    setPairingDraft(null);
                  }}
                  onPrepare={() => void prepareDevicePairing()}
                  onRecoveryKeyChange={setLoginRecoveryKey}
                  recoveryKey={loginRecoveryKey}
                  verificationCode={pairingVerificationCode}
                />
              </>
            )}
            {(mode === 'create' || useRecoveryKey || useDevicePairing) && (
              <>
                <Field label={copy.auth.passwordConfirmLabel}>
                  <input
                    value={passwordConfirmation}
                    onChange={(event) =>
                      setPasswordConfirmation(event.target.value)
                    }
                    className="ui-field-control px-4 py-3 text-sm placeholder:text-white/30"
                    placeholder="••••••••••••"
                    type="password"
                    autoComplete="new-password"
                    data-testid="auth-password-confirmation-input"
                  />
                </Field>
                <PasswordRequirementProgress
                  checks={passwordRequirementChecks}
                />
                {mode === 'create' && (
                  <RecoveryKeyPanel
                    recoveryKey={recoveryKey}
                    confirmed={recoveryKeyConfirmed}
                    onConfirmedChange={setRecoveryKeyConfirmed}
                    onRegenerate={() => {
                      setRecoveryKey(RecoveryKey.generate().valueOf());
                      setRecoveryKeyConfirmed(false);
                    }}
                  />
                )}
              </>
            )}
          </div>

          {error && (
            <div className="ui-inline-notice mt-3 border-rose-300/50 bg-rose-500/10 text-rose-100">
              {error}
            </div>
          )}

          <button
            disabled={!canSubmit || state === 'loading'}
            className={cx(
              'ui-button ui-button-primary mt-6 w-full py-3',
              canSubmit && state !== 'loading'
                ? ''
                : 'cursor-not-allowed text-white/35',
            )}
            data-testid="auth-submit-button"
          >
            {state === 'loading'
              ? mode === 'login' && loginProgressStep
                ? loginProgressLabel(loginProgressStep)
                : copy.auth.loadingSubmit
              : mode === 'login'
                ? copy.auth.loginSubmit
                : copy.auth.createIdentity}
          </button>
          {mode === 'login' && (
            <p className="mt-2 text-center text-xs leading-snug text-white/45">
              {copy.auth.loginSubmitHelp}
            </p>
          )}

          <InstallAppAction
            canShowButton={canShowInstallButton}
            className="mt-5 lg:hidden"
            disabled={installButtonDisabled}
            help={installHelp}
            label={installButtonLabel}
            onClick={handleInstallApp}
            ready={installState === 'ready'}
            showHelp={showInstallHelp}
          />

          <NodeLoginSummary
            availableNetworks={availableNetworks}
            className="mt-5 lg:hidden"
            ipfsPeerCount={ipfsPeerCount}
            networkSynchronizationStatus={networkSynchronizationStatus}
            ownerIdentityId={nodeOwnerId}
            peersLoading={peersLoading}
          />
        </form>
      </div>
    </section>
  );
}

function InstallAppAction({
  canShowButton,
  className,
  disabled,
  help,
  label,
  onClick,
  ready,
  showHelp,
}: {
  canShowButton: boolean;
  className?: string;
  disabled: boolean;
  help: null | string;
  label: string;
  onClick: () => void;
  ready: boolean;
  showHelp: boolean;
}): ReactElement | null {
  const shouldShowHelp = Boolean(help && (showHelp || !canShowButton));

  if (!canShowButton && !shouldShowHelp) return null;

  return (
    <div className={className}>
      {canShowButton && (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={cx(
            'w-full rounded-2xl px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45',
            ready
              ? 'bg-cyan-300/15 text-cyan-50 hover:bg-cyan-300/20'
              : 'bg-white/10 text-white/85 hover:bg-white/15',
          )}
        >
          {label}
        </button>
      )}
      {shouldShowHelp && (
        <p className="mt-3 text-center text-xs leading-snug text-white/45">
          {help}
        </p>
      )}
    </div>
  );
}

function isIosBrowser(): boolean {
  return /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase());
}

function loginProgressLabel(step: LoginIdentityProgressStep): string {
  switch (step) {
    case 'decrypting-keys':
      return copy.auth.loginProgress.decryptingKeys;
    case 'loading-keychain':
      return copy.auth.loginProgress.loadingKeychain;
    case 'loading-workspace':
      return copy.auth.loginProgress.loadingWorkspace;
    case 'resolving-identity':
      return copy.auth.loginProgress.resolvingIdentity;
  }
}

function installFallbackHelp(): string {
  if (import.meta.env.DEV) return copy.auth.installAppDevHelp;

  if (isIosBrowser()) return copy.auth.installAppIosHelp;

  return copy.auth.installAppHelp;
}
