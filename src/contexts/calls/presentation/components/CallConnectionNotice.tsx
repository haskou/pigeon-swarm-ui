import type { CallAudioConnectionState } from '../view-models/callAudioConnectionState';
import type { CallSession } from '../view-models/CallSession';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { callAudioConnectionState } from '../view-models/callAudioConnectionState';

export function CallConnectionNotice({
  call,
  onRetryConnection,
}: {
  call: CallSession;
  onRetryConnection: () => void;
}) {
  const state = callAudioConnectionState(
    call.participants,
    call.currentIdentityId,
  );

  if (!state) return null;

  const message: Record<CallAudioConnectionState, string> = {
    connecting: copy.calls.connectionConnecting,
    failed: copy.calls.connectionRecoveryExhausted,
    reconnecting: copy.calls.connectionRecovering,
    relayed: copy.calls.connectionRelayed,
  };
  const tone =
    state === 'relayed'
      ? 'border-white/10 bg-white/5 text-white/80'
      : 'border-amber-300/25 bg-amber-300/10 text-amber-100';

  return (
    <div role="status" className={`rounded-lg border p-2 text-xs ${tone}`}>
      <p>{message[state]}</p>
      {state === 'failed' && (
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
