import type { CallSession } from '../view-models/CallSession';

import { copy } from '../../../../shared/presentation/i18n/copy';

export function CallRecoveryNotice({
  call,
  onRetryConnection,
}: {
  call: CallSession;
  onRetryConnection: () => void;
}) {
  const peers = call.participants.filter(
    (participant) => participant.identityId !== call.currentIdentityId,
  );
  const exhausted = peers.some(
    (participant) => participant.recoveryState === 'exhausted',
  );
  const recovering = peers.some(
    (participant) => participant.recoveryState === 'recovering',
  );

  if (!exhausted && !recovering) return null;

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-2 text-xs text-amber-100"
    >
      <p>
        {exhausted
          ? copy.calls.connectionRecoveryExhausted
          : copy.calls.connectionRecovering}
      </p>
      {exhausted && (
        <button
          type="button"
          className="mt-2 rounded-lg bg-white/10 px-3 py-2 font-bold hover:bg-white/20"
          onKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRetryConnection();
          }}
        >
          {copy.calls.retryConnection}
        </button>
      )}
    </div>
  );
}
