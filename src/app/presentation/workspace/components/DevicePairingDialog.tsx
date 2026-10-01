import { type ReactElement, useState } from 'react';

import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { DevicePairingCode } from '../../../../contexts/identities/domain/value-objects/DevicePairingCode';
import { DevicePairingCodeField } from '../../../../contexts/identities/presentation/device-pairing/DevicePairingCodeField';
import { DevicePairingQrCode } from '../../../../contexts/identities/presentation/device-pairing/DevicePairingQrCode';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';

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

  const authorize = async () => {
    setState('loading');
    setError(null);

    try {
      const result =
        await applicationContainer.identities.authorizeDevicePairing(
          session,
          DevicePairingCode.fromString(requestCode),
        );

      setCompletionCode(result.completionCode);
      onSessionUpdated(result.session);
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.profile.devicePairingError));
    } finally {
      setState('idle');
    }
  };

  return (
    <div className="app-overlay-scrim fixed inset-0 z-[70] grid place-items-stretch bg-black/70 p-0 backdrop-blur-md sm:place-items-center sm:p-4">
      <div className="app-overlay-surface ui-dialog-surface relative flex h-[100dvh] w-full max-w-xl flex-col overflow-hidden sm:h-auto sm:max-h-[90vh]">
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
              <DevicePairingQrCode
                code={invitation}
                label={copy.profile.devicePairingInvitationQr}
              />
              <DevicePairingCodeField
                label={copy.profile.devicePairingRequestLabel}
                onChange={setRequestCode}
                value={requestCode}
              />
              <button
                className="ui-button ui-button-primary"
                disabled={!requestCode.trim() || state === 'loading'}
                onClick={() => void authorize()}
                type="button"
              >
                {copy.profile.devicePairingAuthorize}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-white/60">
                {copy.profile.devicePairingCompletionHelp}
              </p>
              <DevicePairingQrCode
                code={completionCode}
                label={copy.profile.devicePairingCompletionQr}
              />
              <textarea
                className="ui-field-control min-h-24 resize-y px-3 py-2 font-mono text-xs"
                readOnly
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
