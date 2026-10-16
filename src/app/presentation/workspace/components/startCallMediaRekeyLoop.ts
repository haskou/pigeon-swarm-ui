import type { CallMediaKey } from '../../../../contexts/calls/infrastructure/media/CallMediaKey';

import { logCallWarning } from '../../../../contexts/calls/infrastructure/media/callDebugLogger';

type CallMediaRekeyLoopInput = {
  callId: string;
  currentKey: () => Promise<CallMediaKey>;
  intervalMs?: number;
  rekey: (key: CallMediaKey) => void;
};

/**
 * Polls the media key of a running call every `intervalMs` and hands each
 * key of a newer epoch than the last one it handed over to `rekey`. The
 * first poll hands its key over whatever the epoch: the media layer ignores
 * a key no newer than the one the call runs on. Polls never overlap; a
 * failed poll is logged and the next one runs on schedule.
 */
export function startCallMediaRekeyLoop({
  callId,
  currentKey,
  intervalMs = 15_000,
  rekey,
}: CallMediaRekeyLoopInput): () => void {
  let appliedEpoch: number | undefined;
  let cancelNextPoll = (): void => undefined;
  let stopped = false;

  const poll = (): void => {
    void currentKey()
      .then((key) => {
        if (stopped) return;

        if (appliedEpoch !== undefined && key.epoch <= appliedEpoch) return;
        appliedEpoch = key.epoch;
        rekey(key);
      })
      .catch((caught: unknown) => {
        if (stopped) return;
        logCallWarning('workspace:call-media-rekey:failed', {
          callId,
          error: caught,
        });
      })
      .finally(() => {
        if (stopped) return;
        const timer = setTimeout(poll, intervalMs);

        cancelNextPoll = () => clearTimeout(timer);
      });
  };
  const firstPoll = setTimeout(poll, intervalMs);

  cancelNextPoll = () => clearTimeout(firstPoll);

  return () => {
    stopped = true;
    cancelNextPoll();
  };
}
