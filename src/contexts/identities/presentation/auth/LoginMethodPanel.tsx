import type { ReactElement } from 'react';

import type { DevicePairingRequestDraft } from '../../domain/DevicePairingRequestDraft';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { DevicePairingCodeField } from '../device-pairing/DevicePairingCodeField';
import { DevicePairingCodeOutput } from '../device-pairing/DevicePairingCodeOutput';
import { DevicePairingQrCode } from '../device-pairing/DevicePairingQrCode';
import { Field } from './Field';

export type LoginMethod = 'password' | 'recovery' | 'device';

function Step({
  children,
  number,
  title,
}: {
  children: React.ReactNode;
  number: number;
  title: string;
}): ReactElement {
  return (
    <section className="grid gap-3 rounded-xl border border-white/10 bg-black/15 p-3">
      <h3 className="flex items-center gap-2 text-sm font-black text-white/85">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-cyan-300/15 text-xs text-cyan-100">
          {number}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function LoginMethodPanel({
  completionCode,
  draft,
  invitationCode,
  loading,
  method,
  onCompletionCodeChange,
  onInvitationCodeChange,
  onPrepare,
  onRecoveryKeyChange,
  recoveryKey,
  verificationCode,
}: {
  completionCode: string;
  draft: DevicePairingRequestDraft | null;
  invitationCode: string;
  loading: boolean;
  method: LoginMethod;
  onCompletionCodeChange: (value: string) => void;
  onInvitationCodeChange: (value: string) => void;
  onPrepare: () => void;
  onRecoveryKeyChange: (value: string) => void;
  recoveryKey: string;
  verificationCode: string;
}): ReactElement | null {
  if (method === 'password') return null;

  if (method === 'recovery') {
    return (
      <Field label={copy.auth.recoveryKeyLabel}>
        <input
          value={recoveryKey}
          onChange={(event) => onRecoveryKeyChange(event.target.value)}
          className="ui-field-control px-4 py-3 text-sm placeholder:text-white/30"
          placeholder={copy.auth.recoveryKeyPlaceholder}
          type="password"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          data-testid="auth-recovery-key-input"
        />
        <p className="mt-2 text-xs leading-relaxed text-white/50">
          {copy.auth.recoveryKeyLoginHelp}
        </p>
      </Field>
    );
  }

  return (
    <div className="grid gap-3" data-testid="auth-device-pairing-steps">
      <p className="text-xs leading-relaxed text-white/60">
        {copy.auth.devicePairingIntro}
      </p>
      <Step number={1} title={copy.auth.devicePairingStep1Title}>
        <p className="text-xs leading-relaxed text-white/50">
          {copy.auth.devicePairingStep1Help}
        </p>
        <DevicePairingCodeField
          label={copy.auth.devicePairingInvitationLabel}
          onChange={onInvitationCodeChange}
          placeholder={copy.auth.devicePairingInvitationPlaceholder}
          testId="auth-device-pairing-invitation-input"
          value={invitationCode}
        />
        {!draft && (
          <button
            className="ui-button"
            data-testid="auth-device-pairing-prepare"
            disabled={!invitationCode.trim() || loading}
            onClick={onPrepare}
            type="button"
          >
            {copy.auth.devicePairingPrepare}
          </button>
        )}
      </Step>
      {draft && (
        <>
          <Step number={2} title={copy.auth.devicePairingStep2Title}>
            <p className="text-xs leading-relaxed text-white/50">
              {copy.auth.devicePairingRequestHelp}
            </p>
            <DevicePairingQrCode
              code={draft.getRequest().toCode()}
              label={copy.auth.devicePairingRequestQr}
            />
            <DevicePairingCodeOutput
              label={copy.auth.devicePairingRequestLabel}
              testId="auth-device-pairing-request-output"
              value={draft.getRequest().toCode().valueOf()}
            />
            <div className="ui-inline-notice grid gap-1 text-center">
              <p className="text-xs text-white/60">
                {copy.auth.devicePairingVerificationHelp}
              </p>
              <p
                className="font-mono text-2xl tracking-widest"
                data-testid="auth-device-pairing-verification-code"
              >
                {verificationCode}
              </p>
            </div>
          </Step>
          <Step number={3} title={copy.auth.devicePairingStep3Title}>
            <p className="text-xs leading-relaxed text-white/50">
              {copy.auth.devicePairingStep3Help}
            </p>
            <DevicePairingCodeField
              label={copy.auth.devicePairingCompletionLabel}
              onChange={onCompletionCodeChange}
              placeholder={copy.auth.devicePairingCompletionPlaceholder}
              testId="auth-device-pairing-completion-input"
              value={completionCode}
            />
          </Step>
          <Step number={4} title={copy.auth.devicePairingStep4Title}>
            <p className="text-xs leading-relaxed text-white/50">
              {copy.auth.devicePairingStep4Help}
            </p>
          </Step>
        </>
      )}
    </div>
  );
}
