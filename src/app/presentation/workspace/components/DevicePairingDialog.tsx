import { type ReactElement, useState } from 'react';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { DevicePairingCode } from '../../../../contexts/identities/domain/value-objects/DevicePairingCode';
import { DevicePairingHistoryPolicy } from '../../../../contexts/identities/domain/value-objects/DevicePairingHistoryPolicy';
import { DevicePairingCodeField } from '../../../../contexts/identities/presentation/device-pairing/DevicePairingCodeField';
import { DevicePairingCodeOutput } from '../../../../contexts/identities/presentation/device-pairing/DevicePairingCodeOutput';
import { toDevicePairingErrorMessage } from '../../../../contexts/identities/presentation/view-models/toDevicePairingErrorMessage';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { QrCode } from '../../../../shared/presentation/components/QrCode';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { applicationContainer } from '../../../composition/applicationContainer';
import { profileEditorInputClass, ProfileInput } from './ProfileInput';

const passwordPlaceholder = '••••••••••••';

const historyOptions = [
  {
    label: copy.profile.devicePairingHistoryLast30Days,
    policy: DevicePairingHistoryPolicy.LAST_30_DAYS,
  },
  {
    label: copy.profile.devicePairingHistoryAll,
    policy: DevicePairingHistoryPolicy.ALL,
  },
  {
    label: copy.profile.devicePairingHistoryNone,
    policy: DevicePairingHistoryPolicy.NONE,
  },
];

export function DevicePairingDialog({
  onClose,
  onSessionUpdated,
  session,
}: {
  onClose: () => void;
  onSessionUpdated: (session: Session) => void;
  session: Session;
}): ReactElement {
  const [invitation] = useState(() =>
    applicationContainer.identities.createDevicePairingInvitation(session),
  );
  const [requestCode, setRequestCode] = useState('');
  const [completionCode, setCompletionCode] =
    useState<DevicePairingCode | null>(null);
  const [state, setState] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [historyPolicy, setHistoryPolicy] = useState(
    DevicePairingHistoryPolicy.DEFAULT,
  );

  const review = async () => {
    setState('loading');
    setError(null);

    try {
      setVerificationCode(
        await applicationContainer.identities.verifyDevicePairingRequest(
          DevicePairingCode.fromString(requestCode),
        ),
      );
    } catch (caught) {
      setError(
        toDevicePairingErrorMessage(caught, copy.profile.devicePairingError),
      );
    } finally {
      setState('idle');
    }
  };
  const authorize = async () => {
    setPassword('');

    setState('loading');
    setError(null);

    try {
      const result =
        await applicationContainer.identities.authorizeDevicePairing(
          session,
          DevicePairingCode.fromString(requestCode),
          password,
          historyPolicy,
        );

      setCompletionCode(result.completionCode);
      onSessionUpdated(result.session);
    } catch (caught) {
      setError(
        toDevicePairingErrorMessage(caught, copy.profile.devicePairingError),
      );
    } finally {
      setState('idle');
    }
  };

  useCloseOnEscape(onClose);

  return (
    <div className="app-overlay-scrim fixed inset-0 z-[70] grid place-items-stretch bg-black/70 p-0 backdrop-blur-md sm:place-items-center sm:p-4">
      <div
        aria-label={copy.profile.devicePairingTitle}
        aria-modal="true"
        className="app-overlay-surface ui-dialog-surface relative flex h-[100dvh] w-full max-w-xl flex-col overflow-hidden sm:h-auto sm:max-h-[90vh]"
        role="dialog"
      >
        <DialogHeader
          title={copy.profile.devicePairingTitle}
          onClose={onClose}
        />
        <div className="grid gap-5 overflow-y-auto p-5">
          {!completionCode ? (
            <>
              <p className="text-sm leading-relaxed text-white/60">
                {copy.profile.devicePairingInvitationHelp}
              </p>
              <QrCode
                value={invitation.valueOf()}
                label={copy.profile.devicePairingInvitationQr}
              />
              <DevicePairingCodeOutput
                label={copy.profile.devicePairingInvitationCodeLabel}
                testId="device-pairing-invitation-output"
                value={invitation.valueOf()}
              />
              <DevicePairingCodeField
                label={copy.profile.devicePairingRequestLabel}
                placeholder={copy.profile.devicePairingRequestPlaceholder}
                testId="device-pairing-request-input"
                onChange={(value) => {
                  setRequestCode(value);
                  setVerificationCode(null);
                }}
                value={requestCode}
              />
              {verificationCode && (
                <>
                  <div className="ui-inline-notice grid gap-1 text-center">
                    <p className="text-xs text-white/60">
                      {copy.profile.devicePairingVerificationHelp}
                    </p>
                    <p
                      className="font-mono text-2xl tracking-widest"
                      data-testid="device-pairing-verification-code"
                    >
                      {verificationCode}
                    </p>
                  </div>
                  <ProfileInput
                    label={copy.profile.devicePairingPassword}
                    onChange={setPassword}
                    placeholder={passwordPlaceholder}
                    testId="device-pairing-password-input"
                    type="password"
                    value={password}
                  />
                  <label className="grid gap-2 text-sm font-black text-white/70">
                    {copy.profile.devicePairingHistoryLabel}
                    <select
                      className={`${profileEditorInputClass} text-sm font-normal`}
                      data-testid="device-pairing-history-select"
                      onChange={(event) =>
                        setHistoryPolicy(
                          DevicePairingHistoryPolicy.fromPrimitives(
                            event.target.value,
                          ),
                        )
                      }
                      value={historyPolicy.valueOf()}
                    >
                      {historyOptions.map((option) => (
                        <option
                          key={option.policy.valueOf()}
                          value={option.policy.valueOf()}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs font-normal leading-relaxed text-white/55">
                      {copy.profile.devicePairingHistoryHelp}
                    </span>
                  </label>
                </>
              )}
              <button
                className="ui-button ui-button-primary"
                data-testid="device-pairing-submit"
                disabled={
                  state === 'loading' ||
                  !(verificationCode ? password : requestCode.trim())
                }
                onClick={() => void (verificationCode ? authorize() : review())}
                type="button"
              >
                {verificationCode
                  ? copy.profile.devicePairingAuthorize
                  : copy.profile.devicePairingReview}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-white/60">
                {copy.profile.devicePairingCompletionHelp}
              </p>
              <QrCode
                value={completionCode.valueOf()}
                label={copy.profile.devicePairingCompletionQr}
              />
              <DevicePairingCodeOutput
                label={copy.profile.devicePairingCompletionCodeLabel}
                testId="device-pairing-completion-output"
                value={completionCode.valueOf()}
              />
            </>
          )}
          {error && (
            <div className="ui-inline-notice border-rose-300/50 bg-rose-500/10 text-rose-100">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
