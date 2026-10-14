import type { ReactElement } from 'react';

import { copy } from '../../../../shared/presentation/i18n/copy';

export function DeviceRemovedNotice({
  disabled,
  eraseFailed,
  onPairAgain,
}: {
  disabled: boolean;
  eraseFailed: boolean;
  onPairAgain: () => void;
}): ReactElement {
  return (
    <div
      role="alert"
      className="ui-inline-notice mt-3 border-rose-300/50 bg-rose-500/10 text-rose-100"
    >
      <p className="font-semibold">{copy.auth.deviceRemoved}</p>
      <p className="mt-1 text-sm">
        {eraseFailed
          ? copy.auth.deviceRemovedEraseFailed
          : copy.auth.deviceRemovedHelp}
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={onPairAgain}
        className="ui-button ui-button-primary mt-3 w-full py-3 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {copy.auth.deviceRemovedPair}
      </button>
    </div>
  );
}
