import { FormEvent, type ReactElement, useEffect, useState } from 'react';

import type {
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { NodeNetwork } from '../../../networks/application/list-node-networks/NodeNetwork';
import type { LoginIdentityProgressStep } from '../../application/ports/LoginIdentityProgressStep';

import { loadApplicationContainer } from '../../../../app/composition/loadApplicationContainer';
import { SegmentedControl } from '../../../../shared/presentation/components/segmentedControl';
import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  clearSavedCredentials,
  loadSavedCredentials,
  saveCredentials,
} from '../../infrastructure/storage/savedCredentials';
import {
  clearLocalDeviceUnlock,
  saveLocalDeviceUnlock,
} from '../../infrastructure/storage/localDeviceUnlock';
import { RecoveryKey } from '../../domain/value-objects/RecoveryKey';
import { WebAuthnPrfKeyProtector } from '../../infrastructure/crypto/WebAuthnPrfKeyProtector';
import {
  normalizeHandleInput,
  passwordValidationChecks,
} from './credentialsValidation';
import { cx } from '../../../../shared/presentation/cx';
import { useInstallPrompt } from '../../../../shared/presentation/hooks/useInstallPrompt';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { AuthFormFields } from './AuthFormFields';
import {
  type AuthMode,
  canSubmitAuthForm,
  normalizeIdentityLogin,
  registrationNetworks,
} from './authFormRules';
import { Field } from './Field';

type LoadState = 'idle' | 'loading' | 'error';
type PasskeyPrfSupportState = 'available' | 'checking' | 'unavailable';

interface AuthScreenProps {
  availableNetworks: NodeNetwork[];
  onAuthenticated: (
    session: Session,
    conversations: ConversationResource[],
  ) => void;
}

export function AuthScreen({
  availableNetworks,
  onAuthenticated,
}: AuthScreenProps): ReactElement {
  const [mode, setMode] = useState<AuthMode>('login');
  const [identityId, setIdentityId] = useState('');
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
  const [useRecoveryKey, setUseRecoveryKey] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [passkeyPrfEnabled, setPasskeyPrfEnabled] = useState(true);
  const [passkeyPrfSupport, setPasskeyPrfSupport] =
    useState<PasskeyPrfSupportState>('checking');
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loginProgressStep, setLoginProgressStep] =
    useState<LoginIdentityProgressStep | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const { installState, requestInstall } = useInstallPrompt();
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const modeOptions = [
    { label: copy.auth.login, value: 'login' },
    { label: copy.auth.createIdentityShort, value: 'create' },
  ] satisfies Array<{ label: string; value: AuthMode }>;

  useEffect(() => {
    if (availableNetworks.length > 0 && !selectedNetwork) {
      setSelectedNetwork(availableNetworks[0].id);
    }
  }, [availableNetworks, selectedNetwork]);

  useEffect(() => {
    const savedCredentials = loadSavedCredentials();

    if (savedCredentials) {
      setIdentityId(savedCredentials.identityId);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    WebAuthnPrfKeyProtector.isPrfAvailable()
      .then((available) => {
        if (mounted) {
          setPasskeyPrfSupport(available ? 'available' : 'unavailable');
        }
      })
      .catch(() => {
        if (mounted) setPasskeyPrfSupport('unavailable');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const canSubmit =
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
    (mode !== 'login' || !useRecoveryKey || RecoveryKey.isValid(loginRecoveryKey)) &&
    (mode === 'login' || recoveryKeyConfirmed);
  const passkeyPrfAvailable = passkeyPrfSupport === 'available';
  const passkeyPrfUnavailable = passkeyPrfSupport === 'unavailable';
  const passwordChecks = passwordValidationChecks(password);
  const passwordRequirementProgress = createPasswordRequirementProgress({
    checks: {
      ...passwordChecks,
      match: password.length > 0 && password === passwordConfirmation,
    },
  });
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
          ? await applicationContainer.login(
              normalizeIdentityLogin(identityId),
              password,
              setLoginProgressStep,
              useRecoveryKey ? loginRecoveryKey.trim() || undefined : undefined,
            )
          : await applicationContainer.register(
              name,
              password,
              registrationNetworks({
                availableNetworkCount: availableNetworks.length,
                fallbackNetworks: networks,
                selectedNetwork,
              }),
              handle.trim() ? normalizeHandleInput(handle) : undefined,
              {
                passkeyPrfEnabled: passkeyPrfEnabled && passkeyPrfAvailable,
                recoveryKey,
              },
            );

      if (rememberMe) {
        await saveLocalDeviceUnlock(result.session).catch(() => undefined);
        saveCredentials({
          identityId: result.session.identity.id,
        });
      } else {
        clearSavedCredentials();
        await clearLocalDeviceUnlock(result.session.identity.id);
      }

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
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_480px] lg:items-center">
        <div className="hidden lg:block">
          <div className="glass-panel-strong rounded-2xl p-8">
            <img
              src="/logo.png"
              alt="Pigeon Swarm"
              className="floaty h-28 w-28 rounded-2xl shadow-2xl shadow-indigo-950/40"
            />
            <h1 className="mt-8 max-w-xl text-6xl font-black tracking-[-.07em]">
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

          <InstallAppAction
            canShowButton={canShowInstallButton}
            className="mb-5 lg:hidden"
            disabled={installButtonDisabled}
            help={installHelp}
            label={installButtonLabel}
            onClick={handleInstallApp}
            ready={installState === 'ready'}
            showHelp={showInstallHelp}
          />

          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={modeOptions}
            data-testid="auth-mode-control"
          />

          <div className="mt-6 space-y-4">
            <AuthFormFields
              availableNetworks={availableNetworks}
              handle={handle}
              identityId={identityId}
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

            <Field label={copy.auth.passwordLabel}>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                placeholder="••••••••••••"
                type="password"
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                data-testid="auth-password-input"
              />
            </Field>
            {mode === 'login' && (
              <div className="rounded-2xl px-1 py-1">
                <button
                  type="button"
                  aria-pressed={useRecoveryKey}
                  onClick={() => setUseRecoveryKey((enabled) => !enabled)}
                  className="flex w-full items-center gap-3 rounded-2xl py-2 text-left text-sm font-bold text-white/65 transition hover:text-white/80"
                  data-testid="auth-use-recovery-key-toggle"
                >
                  <AuthSwitch enabled={useRecoveryKey} />
                  <span>{copy.auth.useRecoveryKey}</span>
                </button>
                {useRecoveryKey && (
                  <div className="mt-3">
                    <Field label={copy.auth.recoveryKeyLabel}>
                      <input
                        value={loginRecoveryKey}
                        onChange={(event) =>
                          setLoginRecoveryKey(event.target.value)
                        }
                        className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                        placeholder="psrk1..."
                        type="password"
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        data-testid="auth-recovery-key-input"
                      />
                      <p className="mt-2 text-xs leading-relaxed text-white/40">
                        {copy.auth.recoveryKeyLoginHelp}
                      </p>
                    </Field>
                  </div>
                )}
              </div>
            )}
            {mode === 'create' && (
              <>
                <Field label={copy.auth.passwordConfirmLabel}>
                  <input
                    value={passwordConfirmation}
                    onChange={(event) =>
                      setPasswordConfirmation(event.target.value)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                    placeholder="••••••••••••"
                    type="password"
                    autoComplete="new-password"
                    data-testid="auth-password-confirmation-input"
                  />
                </Field>
                <PasswordRequirementProgress
                  complete={passwordRequirementProgress.complete}
                  total={passwordRequirementProgress.total}
                  message={passwordRequirementProgress.message}
                />
                <RecoveryKeyPanel
                  recoveryKey={recoveryKey}
                  confirmed={recoveryKeyConfirmed}
                  onConfirmedChange={setRecoveryKeyConfirmed}
                  onRegenerate={() => {
                    setRecoveryKey(RecoveryKey.generate().valueOf());
                    setRecoveryKeyConfirmed(false);
                  }}
                />
                <button
                  type="button"
                  aria-pressed={passkeyPrfEnabled}
                  disabled={!passkeyPrfAvailable}
                  data-testid="auth-passkey-prf-toggle"
                  onClick={() =>
                    passkeyPrfAvailable &&
                    setPasskeyPrfEnabled((enabled) => !enabled)
                  }
                  className={cx(
                    'flex w-full items-start gap-3 rounded-2xl px-1 py-2 text-left transition',
                    passkeyPrfAvailable
                      ? passkeyPrfEnabled
                        ? 'text-white'
                        : 'text-white/75 hover:bg-white/[0.04]'
                      : 'cursor-not-allowed opacity-55',
                  )}
                >
                  <AuthSwitch
                    enabled={passkeyPrfEnabled && passkeyPrfAvailable}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-white/80">
                      {copy.auth.passkeyPrf}
                    </span>
                    <span className="mt-1 block text-xs leading-snug text-white/45">
                      {passkeyPrfSupport === 'checking'
                        ? copy.auth.passkeyPrfChecking
                        : passkeyPrfAvailable
                          ? copy.auth.passkeyPrfHelp
                          : copy.auth.passkeyPrfUnavailable}
                    </span>
                  </span>
                </button>
                {passkeyPrfUnavailable && (
                  <PasskeyPrfUnavailableNotice>
                    {copy.auth.passkeyPrfUnavailableCreate}
                  </PasskeyPrfUnavailableNotice>
                )}
              </>
            )}
          </div>

          {mode === 'login' && passkeyPrfUnavailable && (
            <div className="mt-4">
              <PasskeyPrfUnavailableNotice>
                {copy.auth.passkeyPrfUnavailableLogin}
              </PasskeyPrfUnavailableNotice>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3 rounded-2xl px-1 py-2">
            <button
              type="button"
              id="remember-me"
              aria-pressed={rememberMe}
              onClick={() => setRememberMe(!rememberMe)}
              className="shrink-0 focus:outline-none"
            >
              <AuthSwitch enabled={rememberMe} />
            </button>
            <label
              htmlFor="remember-me"
              className="block min-w-0 cursor-pointer text-sm text-white/60"
            >
              <span className="block font-bold text-white/70">
                {copy.auth.rememberMe}
              </span>
            </label>
          </div>

          {error && (
            <div className="mt-3 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-4 text-sm text-rose-100">
              {error}
            </div>
          )}

          <button
            disabled={!canSubmit || state === 'loading'}
            className={cx(
              'mt-6 w-full rounded-2xl px-5 py-4 text-sm font-black transition',
              canSubmit && state !== 'loading'
                ? 'glass-button bg-gradient-to-r from-cyan-300 to-fuchsia-500 text-white shadow-xl shadow-fuchsia-950/30 hover:scale-[1.01]'
                : 'cursor-not-allowed bg-white/10 text-white/35',
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

interface PasswordRequirementProgressProps {
  complete: number;
  message: string;
  total: number;
}

function AuthSwitch({ enabled }: { enabled: boolean }): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex h-6 w-11 shrink-0 items-center rounded-full border border-white/10 transition-colors',
        enabled ? 'bg-cyan-400/25' : 'bg-black/25',
      )}
    >
      <span
        className={cx(
          'h-4 w-4 rounded-full bg-white transition-transform',
          enabled ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </span>
  );
}

function PasskeyPrfUnavailableNotice({
  children,
}: {
  children: string;
}): ReactElement {
  return (
    <div
      data-testid="auth-passkey-prf-warning"
      className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-xs leading-snug text-amber-50/80"
    >
      {children}
    </div>
  );
}

function RecoveryKeyPanel({
  confirmed,
  onConfirmedChange,
  onRegenerate,
  recoveryKey,
}: {
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  onRegenerate: () => void;
  recoveryKey: string;
}): ReactElement {
  return (
    <section className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-black text-amber-50">
            {copy.auth.recoveryKeyTitle}
          </h2>
          <p className="mt-1 text-xs leading-snug text-amber-50/70">
            {copy.auth.recoveryKeyCreateHelp}
          </p>
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white/75 transition hover:bg-white/15"
        >
          {copy.auth.recoveryKeyRegenerate}
        </button>
      </div>
      <textarea
        readOnly
        value={recoveryKey}
        className="mt-3 h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-3 font-mono text-xs text-white outline-none"
        data-testid="auth-recovery-key-output"
      />
      <button
        type="button"
        aria-pressed={confirmed}
        onClick={() => onConfirmedChange(!confirmed)}
        className="mt-3 flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left text-sm font-bold text-white/75"
        data-testid="auth-recovery-key-confirm"
      >
        <AuthSwitch enabled={confirmed} />
        <span>{copy.auth.recoveryKeySaved}</span>
      </button>
    </section>
  );
}

function PasswordRequirementProgress({
  complete,
  message,
  total,
}: PasswordRequirementProgressProps): ReactElement {
  const percentage = total > 0 ? Math.round((complete / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={cx(
            'h-full rounded-full transition-[width,background-color]',
            complete === total
              ? 'bg-emerald-300'
              : 'bg-gradient-to-r from-cyan-300 to-fuchsia-500',
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p
        className={cx(
          'mt-2 text-xs font-bold leading-snug',
          complete === total ? 'text-emerald-200' : 'text-white/55',
        )}
      >
        {message}
      </p>
    </div>
  );
}

interface PasswordRequirementProgressInput {
  checks: {
    lowercase: boolean;
    match: boolean;
    maxLength: boolean;
    minLength: boolean;
    number: boolean;
    symbol: boolean;
    uppercase: boolean;
  };
}

function createPasswordRequirementProgress({
  checks,
}: PasswordRequirementProgressInput): PasswordRequirementProgressProps {
  const values = Object.values(checks);
  const complete = values.filter(Boolean).length;
  const total = values.length;

  return {
    complete,
    message: nextPasswordRequirementMessage(checks),
    total,
  };
}

function nextPasswordRequirementMessage(
  checks: PasswordRequirementProgressInput['checks'],
): string {
  if (!checks.uppercase) return copy.auth.passwordRequirementNext.uppercase;
  if (!checks.number) return copy.auth.passwordRequirementNext.number;
  if (!checks.symbol) return copy.auth.passwordRequirementNext.symbol;
  if (!checks.match) return copy.auth.passwordRequirementNext.match;
  if (Object.values(checks).every(Boolean)) {
    return copy.auth.passwordRequirementNext.valid;
  }

  return copy.auth.passwordRequirements;
}

function loginProgressLabel(step: LoginIdentityProgressStep): string {
  switch (step) {
    case 'confirming-passkey':
      return copy.auth.loginProgress.confirmingPasskey;
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
