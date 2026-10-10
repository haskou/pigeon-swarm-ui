import { type ReactElement, useCallback, useEffect, useState } from 'react';

import type { DeviceCredential } from '../../../../contexts/identities/domain/value-objects/DeviceCredential';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { DeviceAuthorizationRevision } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';
import { DeviceRevocationPanel } from './DeviceRevocationPanel';

const FINGERPRINT_LENGTH = 12;

function fingerprint(credential: DeviceCredential): string {
  return IdentityId.normalize(credential.valueOf()).slice(-FINGERPRINT_LENGTH);
}

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
  const own = IdentityId.normalize(
    session.deviceCredentialKeyPair.toPrimitives().publicKey,
  );

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
    <div className="app-overlay-scrim fixed inset-0 z-[70] grid place-items-stretch bg-black/70 p-0 backdrop-blur-md sm:place-items-center sm:p-4">
      <div className="app-overlay-surface ui-dialog-surface relative flex h-[100dvh] w-full max-w-xl flex-col overflow-hidden sm:h-auto sm:max-h-[90vh]">
        <DialogHeader
          title={copy.profile.deviceManageTitle}
          onClose={onClose}
        />
        <div className="grid gap-4 overflow-y-auto p-5">
          <p className="text-sm leading-relaxed text-white/60">
            {copy.profile.deviceManageHelp}
          </p>
          {error && (
            <p className="ui-inline-notice" role="alert">
              {error}
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
                  <span className="font-mono text-sm">
                    {fingerprint(device)}
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
                      {copy.profile.deviceRetire} /{' '}
                      {copy.profile.deviceRevokeCompromised}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {selected && (
            <DeviceRevocationPanel
              fingerprint={fingerprint(selected)}
              latestRevision={current.authorizationRevision.valueOf()}
              onCancel={() => setSelected(null)}
              onRevoke={revoke}
            />
          )}
        </div>
      </div>
    </div>
  );
}
