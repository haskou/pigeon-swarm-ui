import { useEffect, useState } from 'react';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { DeviceUnlockMethod } from '../../../../contexts/identities/infrastructure/storage/DeviceUnlockMethod';

import {
  isValidPassword,
  passwordValidationChecks,
} from '../../../../contexts/identities/presentation/auth/credentialsValidation';
import { PasswordRequirementProgress } from '../../../../contexts/identities/presentation/auth/PasswordRequirementProgress';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';
import { ProfileInput } from './ProfileInput';

type PasskeyUnlockFormProps = {
  onDone: () => void;
  session: Session;
};

const passwordPlaceholder = '••••••••••••';

function usePasskeyUnlockSubmit(
  change: () => Promise<void>,
  onDone: () => void,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);

    try {
      await change();
      onDone();
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.profile.updateError));
    }
    setBusy(false);
  };

  return { busy, error, submit };
}

function PasskeyUnlockError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      className="ui-inline-notice border-rose-300/50 bg-rose-500/10 text-rose-100"
      role="alert"
    >
      {message}
    </div>
  );
}

function PasskeyUnlockSubmit({
  disabled,
  label,
  onSubmit,
}: {
  disabled: boolean;
  label: string;
  onSubmit: () => Promise<void>;
}) {
  return (
    <button
      className="ui-button ui-button-primary w-full"
      data-testid="profile-passkey-submit"
      disabled={disabled}
      onClick={() => void onSubmit()}
      type="button"
    >
      {label}
    </button>
  );
}

function PasskeyEnableForm({ onDone, session }: PasskeyUnlockFormProps) {
  const [password, setPassword] = useState('');
  const { busy, error, submit } = usePasskeyUnlockSubmit(
    () =>
      applicationContainer.identities.enablePasskeyUnlock(session, password),
    onDone,
  );

  return (
    <div className="mt-3 grid gap-3">
      <p className="text-xs font-bold text-white/45">
        {copy.profile.passkeyEnableHelp}
      </p>
      <ProfileInput
        label={copy.profile.currentPassword}
        value={password}
        onChange={setPassword}
        placeholder={passwordPlaceholder}
        type="password"
      />
      <PasskeyUnlockSubmit
        disabled={busy || !password.trim()}
        label={copy.profile.passkeyEnable}
        onSubmit={submit}
      />
      <PasskeyUnlockError message={error} />
    </div>
  );
}

function PasskeyDisableForm({ onDone, session }: PasskeyUnlockFormProps) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const passwordsMatch = password.length > 0 && password === confirmation;
  const { busy, error, submit } = usePasskeyUnlockSubmit(
    () =>
      applicationContainer.identities.disablePasskeyUnlock(session, password),
    onDone,
  );

  return (
    <div className="mt-3 grid gap-3">
      <p className="text-xs font-bold text-white/45">
        {copy.profile.passkeyDisableHelp}
      </p>
      <ProfileInput
        label={copy.profile.newPassword}
        value={password}
        onChange={setPassword}
        placeholder={passwordPlaceholder}
        type="password"
      />
      <ProfileInput
        label={copy.profile.newPasswordConfirm}
        value={confirmation}
        onChange={setConfirmation}
        placeholder={passwordPlaceholder}
        type="password"
      />
      <PasswordRequirementProgress
        checks={{
          ...passwordValidationChecks(password),
          match: passwordsMatch,
        }}
      />
      <PasskeyUnlockSubmit
        disabled={busy || !passwordsMatch || !isValidPassword(password)}
        label={copy.profile.passkeyDisableConfirm}
        onSubmit={submit}
      />
      <PasskeyUnlockError message={error} />
    </div>
  );
}

function PasskeyUnlockChange({
  method,
  onChanged,
  session,
}: {
  method: DeviceUnlockMethod;
  onChanged: (method: DeviceUnlockMethod) => void;
  session: Session;
}) {
  const [open, setOpen] = useState(false);
  const passkeyActive = method === 'passkey';
  const finish = () => {
    setOpen(false);
    onChanged(passkeyActive ? 'password' : 'passkey');
  };

  if (!open) {
    return (
      <button
        className="ui-button mt-3 w-full"
        data-testid="profile-passkey-toggle"
        onClick={() => setOpen(true)}
        type="button"
      >
        {passkeyActive
          ? copy.profile.passkeyDisable
          : copy.profile.passkeyEnable}
      </button>
    );
  }

  return passkeyActive ? (
    <PasskeyDisableForm onDone={finish} session={session} />
  ) : (
    <PasskeyEnableForm onDone={finish} session={session} />
  );
}

/**
 * Lets the user replace this device's password unlock with a passkey, or go
 * back to a password. Only one of them unlocks the device at a time.
 */
export function ProfilePasskeyUnlock({
  onMethodChange,
  session,
}: {
  onMethodChange: (method: DeviceUnlockMethod | undefined) => void;
  session: Session;
}) {
  const [availability, setAvailability] = useState<{
    method: DeviceUnlockMethod | undefined;
    supported: boolean;
  }>({
    method: undefined,
    supported: false,
  });
  const identityId = session.identity.id;
  const { method, supported } = availability;

  useEffect(() => {
    let active = true;

    void Promise.all([
      applicationContainer.identities.localUnlockMethod(identityId),
      applicationContainer.identities.passkeyUnlockSupported(),
    ]).then(
      ([nextMethod, nextSupported]) => {
        if (!active) return;
        setAvailability({ method: nextMethod, supported: nextSupported });
        onMethodChange(nextMethod);
      },
      () => undefined,
    );

    return () => {
      active = false;
    };
  }, [identityId, onMethodChange]);

  if (!method) return null;

  const passkeyActive = method === 'passkey';
  const status = passkeyActive
    ? copy.profile.passkeyUnlockActive
    : supported
      ? copy.profile.passkeyUnlockHelp
      : copy.profile.passkeyUnsupported;
  const changeMethod = (nextMethod: DeviceUnlockMethod) => {
    setAvailability({ method: nextMethod, supported });
    onMethodChange(nextMethod);
  };

  return (
    <div
      className="border-t border-white/[0.06] px-4 py-4"
      data-testid="profile-passkey-unlock"
    >
      <p className="text-sm font-black text-white/75">
        {copy.profile.passkeyUnlock}
      </p>
      <p className="mt-1 text-xs font-bold text-white/40">{status}</p>
      {(passkeyActive || supported) && (
        <PasskeyUnlockChange
          method={method}
          onChanged={changeMethod}
          session={session}
        />
      )}
    </div>
  );
}
