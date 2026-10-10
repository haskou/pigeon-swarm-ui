import { type ReactElement, useState } from 'react';

import { copy } from '../../../../shared/presentation/i18n/copy';

export function DeviceRevocationPanel({
  fingerprint,
  latestRevision,
  onCancel,
  onRevoke,
}: {
  fingerprint: string;
  latestRevision: number;
  onCancel: () => void;
  onRevoke: (compromisedSince?: number) => Promise<void>;
}): ReactElement {
  const [compromised, setCompromised] = useState(false);
  const [since, setSince] = useState(1);
  const [busy, setBusy] = useState(false);
  const valid = !compromised || (since >= 1 && since <= latestRevision);

  const confirm = async () => {
    setBusy(true);

    try {
      await onRevoke(compromised ? since : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="ui-inline-notice grid gap-3"
      data-testid="device-revoke-panel"
    >
      <p className="font-mono text-sm">{fingerprint}</p>
      <div className="flex gap-2">
        <button
          aria-pressed={!compromised}
          className="ui-button"
          data-testid="device-mode-retire"
          onClick={() => setCompromised(false)}
          type="button"
        >
          {copy.profile.deviceRetire}
        </button>
        <button
          aria-pressed={compromised}
          className="ui-button"
          data-testid="device-mode-compromised"
          onClick={() => setCompromised(true)}
          type="button"
        >
          {copy.profile.deviceRevokeCompromised}
        </button>
      </div>
      {compromised ? (
        <label className="grid gap-1 text-sm">
          {copy.profile.deviceCompromiseFromLabel}
          <input
            className="ui-input"
            data-testid="device-compromise-since"
            max={latestRevision}
            min={1}
            onChange={(event) => setSince(Number(event.target.value))}
            type="number"
            value={since}
          />
          <span className="text-xs text-white/60">
            {copy.profile.deviceCompromiseHelp.replace(
              '{revision}',
              String(latestRevision),
            )}
          </span>
        </label>
      ) : (
        <p className="text-xs text-white/60">
          {copy.profile.deviceRetireConfirm}
        </p>
      )}
      <div className="flex gap-2">
        <button
          className="ui-button ui-button-danger"
          data-testid="device-revoke-confirm"
          disabled={!valid || busy}
          onClick={() => void confirm()}
          type="button"
        >
          {copy.profile.deviceRevokeConfirm}
        </button>
        <button className="ui-button" onClick={onCancel} type="button">
          {copy.dialog.cancel}
        </button>
      </div>
    </div>
  );
}
