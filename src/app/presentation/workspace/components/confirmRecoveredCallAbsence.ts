import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';

type RecoveredCallAbsenceInput = {
  callId: string;
  currentIdentityId: string;
  getCall: (callId: string) => Promise<CallResource>;
  initialRetryDelayMs?: number;
  isMediaAlive: () => boolean;
  maxPendingMs?: number;
  maxRetryDelayMs?: number;
  onConfirmed: (call: CallResource) => void;
  onEnded: () => void;
};

function provesCallIsGone(caught: unknown): boolean {
  if (!(caught instanceof HttpJsonError)) return false;

  return (
    [401, 403, 404].includes(caught.status) ||
    (caught.status === 409 && caught.code === 'CallNotFoundError')
  );
}

function stillJoined(call: CallResource, identityId: string): boolean {
  return (
    call.status !== 'ended' &&
    call.participants.some(
      (participant) =>
        participant.identityId === identityId &&
        participant.status === 'joined',
    )
  );
}

/**
 * A recovered call list is only a snapshot: after a node restart it can omit
 * a call whose records are still pending. Confirm the absence by id before
 * ending the call. Not-ready and transient errors keep the call and retry with
 * backoff. Retries are bounded: once confirmation has been pending longer
 * than `maxPendingMs`, a call whose media is no longer alive is ended, so a
 * peer that keeps the records pending cannot hold a dead call open.
 */
export function confirmRecoveredCallAbsence({
  callId,
  currentIdentityId,
  getCall,
  initialRetryDelayMs = 1000,
  isMediaAlive,
  maxPendingMs = 30_000,
  maxRetryDelayMs = 8000,
  onConfirmed,
  onEnded,
}: RecoveredCallAbsenceInput): () => void {
  const startedAt = Date.now();
  let retryDelayMs = initialRetryDelayMs;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const end = (): void => {
    stopped = true;
    onEnded();
  };

  function check(): void {
    if (stopped) return;

    getCall(callId).then(
      (call) => {
        if (stopped) return;

        if (!stillJoined(call, currentIdentityId)) {
          end();

          return;
        }
        stopped = true;
        onConfirmed(call);
      },
      (caught: unknown) => {
        if (stopped) return;

        if (
          provesCallIsGone(caught) ||
          (Date.now() - startedAt >= maxPendingMs && !isMediaAlive())
        ) {
          end();

          return;
        }
        retryTimer = setTimeout(check, retryDelayMs);
        retryDelayMs = Math.min(retryDelayMs * 2, maxRetryDelayMs);
      },
    );
  }

  check();

  return () => {
    stopped = true;
    clearTimeout(retryTimer);
  };
}
