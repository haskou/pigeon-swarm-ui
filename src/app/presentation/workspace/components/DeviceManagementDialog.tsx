import { type ReactElement, useCallback, useEffect, useState } from 'react';

import type { DeviceCredential } from '../../../../contexts/identities/domain/value-objects/DeviceCredential';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { DeviceAuthorizationRevision } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { KeyFingerprint } from '../../../../contexts/identities/presentation/view-models/KeyFingerprint';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';
import { DeviceRevocationPanel } from './DeviceRevocationPanel';

export function DeviceManagementDialog({
  onClose,
  onSessionUpdated,
  session,
}: {
  onClose: () => void;
  onSessionUpdated: (session: Session) => void;
  session: Session;
}): ReactElement {
  const [devices, setDevices] = useState<DeviceCredential[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DeviceCredential | null>(null);
  const [current, setCurrent] = useState(session);
  const { close, state } = useCloseTransition(onClose);
  const own = IdentityId.normalize(
    session.deviceCredentialKeyPair.toPrimitives().publicKey,
  );

  useCloseOnEscape(close);

  const load = useCallback(async (from: Session) => {
    try {
      setDevices(await applicationContainer.identities.listDevices(from));
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.profile.deviceListError));
    }
  }, []);

  useEffect(() => {
    void load(session);
  }, [load, session]);

  const revoke = async (compromisedSince?: number) => {
    if (!selected) return;
    setError(null);

    try {
      const next = await applicationContainer.identities.revokeDevice(
        current,
        selected,
        compromisedSince === undefined
          ? undefined
          : DeviceAuthorizationRevision.fromNumber(compromisedSince),
      );

      setCurrent(next);
      onSessionUpdated(next);
      setSelected(null);
      await load(next);
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.profile.deviceRevokeError));
    }
  };

  return (
    <div
      className="app-overlay-scrim fixed inset-0 z-[70] grid place-items-stretch bg-black/70 p-0 backdrop-blur-md sm:place-items-center sm:p-4"
      data-state={state}
    >
      <button
        type="button"
        className="absolute inset-0"
        onClick={close}
        aria-label={copy.dialog.close}
      />
      <section
        aria-label={copy.profile.deviceManageTitle}
        aria-modal="true"
        className="app-overlay-surface ui-dialog-surface relative z-10 flex h-[100dvh] w-full max-w-xl flex-col overflow-hidden sm:h-auto sm:max-h-[90vh]"
        data-state={state}
        role="dialog"
      >
        <DialogHeader title={copy.profile.deviceManageTitle} onClose={close} />
        <div className="grid gap-4 overflow-y-auto p-5">
          <p className="text-sm leading-relaxed text-white/60">
            {copy.profile.deviceManageHelp}
          </p>
          {error && (
            <p className="ui-inline-notice" role="alert">
              {error}
            </p>
          )}
          {!devices && !error && (
            <p aria-live="polite" className="text-sm text-white/60">
              {copy.profile.deviceListLoading}
            </p>
          )}
          {devices?.length === 0 && (
            <p className="text-sm text-white/60">
              {copy.profile.deviceListEmpty}
            </p>
          )}
          <ul className="grid gap-2" data-testid="device-list">
            {devices?.map((device) => {
              const isOwn = IdentityId.normalize(device.valueOf()) === own;

              return (
                <li
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] px-3 py-2"
                  data-testid="device-row"
                  key={device.valueOf()}
                >
                  <span className="min-w-0 break-all font-mono text-sm">
                    {KeyFingerprint.ofPublicKey(device.valueOf())}
                  </span>
                  {isOwn ? (
                    <span className="text-xs text-white/60">
                      {copy.profile.deviceCurrent}
                    </span>
                  ) : (
                    <button
                      className="ui-button"
                      data-testid="device-revoke-open"
                      onClick={() => setSelected(device)}
                      type="button"
                    >
                      {copy.profile.deviceRemoveAccess}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {selected && (
            <DeviceRevocationPanel
              fingerprint={KeyFingerprint.ofPublicKey(selected.valueOf())}
              latestRevision={current.authorizationRevision.valueOf()}
              onCancel={() => setSelected(null)}
              onRevoke={revoke}
            />
          )}
        </div>
      </section>
    </div>
  );
}
