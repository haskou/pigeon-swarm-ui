import { logCallWarning } from './callDebugLogger';

const disconnectedPeerRecoveryDelayMs = 3_000;
const maximumPeerRecoveryDelayMs = 15_000;
const checkingPeerRecoveryDelayMs = 15_000;
const maximumPeerRecoveryAttempts = 3;
const peerRestartOutcomeWaitMs = 15_000;
const credentialRefreshTimeoutMs = 15_000;

export class CallPeerRecovery {
  private readonly inFlight = new Map<string, AbortController>();

  private readonly attempts = new Map<string, number>();

  private readonly pending = new Map<
    string,
    { deadline: number; timeout: ReturnType<typeof setTimeout> }
  >();

  private readonly retryNotBefore = new Map<string, number>();

  public constructor(
    private readonly restartIce: (
      peer: RTCPeerConnection,
      canRestart: () => boolean,
    ) => Promise<void>,
  ) {}

  private cancel(peerIdentityId: string): void {
    const timeout = this.pending.get(peerIdentityId);

    if (timeout === undefined) return;

    clearTimeout(timeout.timeout);
    this.pending.delete(peerIdentityId);
  }

  private delay(peer: RTCPeerConnection, attempt: number): number | undefined {
    if (attempt >= maximumPeerRecoveryAttempts) return undefined;

    if (
      peer.connectionState === 'failed' ||
      peer.iceConnectionState === 'failed'
    ) {
      return Math.min(
        attempt === 0 ? 0 : 2 ** (attempt - 1) * 1_000,
        maximumPeerRecoveryDelayMs,
      );
    }

    if (
      peer.connectionState === 'disconnected' ||
      peer.iceConnectionState === 'disconnected'
    ) {
      return disconnectedPeerRecoveryDelayMs;
    }

    if (peer.iceConnectionState === 'checking') {
      return checkingPeerRecoveryDelayMs;
    }

    return undefined;
  }

  private isHealthy(peer: RTCPeerConnection): boolean {
    return (
      peer.connectionState === 'connected' &&
      (peer.iceConnectionState === 'connected' ||
        peer.iceConnectionState === 'completed')
    );
  }

  private schedule(
    peerIdentityId: string,
    peer: RTCPeerConnection,
    attempt: number,
    delay: number,
    isCurrent: () => boolean,
  ): void {
    const deadline = Date.now() + delay;
    const pending = this.pending.get(peerIdentityId);

    if (pending && pending.deadline <= deadline) return;

    this.cancel(peerIdentityId);

    logCallWarning('peer-manager:ice-recovery:scheduled', {
      attempt: attempt + 1,
      connectionState: peer.connectionState,
      delay,
      iceConnectionState: peer.iceConnectionState,
      peerIdentityId,
    });
    const timeout = setTimeout(() => {
      this.pending.delete(peerIdentityId);

      if (
        !isCurrent() ||
        peer.connectionState === 'closed' ||
        this.isHealthy(peer)
      ) {
        return;
      }

      void this.restart(peerIdentityId, peer, attempt, isCurrent);
    }, delay);

    this.pending.set(peerIdentityId, { deadline, timeout });
  }

  private async restart(
    peerIdentityId: string,
    peer: RTCPeerConnection,
    attempt: number,
    isCurrent: () => boolean,
  ): Promise<void> {
    const controller = new AbortController();
    this.inFlight.set(peerIdentityId, controller);
    this.attempts.set(peerIdentityId, attempt + 1);
    const cancelled = new Promise<void>((resolve) => {
      controller.signal.addEventListener('abort', () => resolve(), {
        once: true,
      });
    });
    const timeout = setTimeout(
      () => controller.abort(),
      credentialRefreshTimeoutMs,
    );
    const canRestart = (): boolean =>
      !controller.signal.aborted &&
      isCurrent() &&
      peer.connectionState !== 'closed' &&
      !this.isHealthy(peer);

    try {
      await Promise.race([this.restartIce(peer, canRestart), cancelled]);
    } catch {
      // HTTP errors may contain credentials or response bodies.
      logCallWarning('peer-manager:ice-recovery:configuration-unavailable', {
        attempt: attempt + 1,
      });
    } finally {
      clearTimeout(timeout);
      controller.abort();

      if (this.inFlight.get(peerIdentityId) === controller) {
        this.inFlight.delete(peerIdentityId);
        this.retryNotBefore.set(
          peerIdentityId,
          Date.now() + peerRestartOutcomeWaitMs,
        );
        this.reconcile(peerIdentityId, peer, isCurrent);
      }
    }
  }

  public forget(peerIdentityId: string): void {
    this.cancel(peerIdentityId);
    this.inFlight.get(peerIdentityId)?.abort();
    this.inFlight.delete(peerIdentityId);
    this.attempts.delete(peerIdentityId);
    this.retryNotBefore.delete(peerIdentityId);
  }

  public reconcile(
    peerIdentityId: string,
    peer: RTCPeerConnection,
    isCurrent: () => boolean,
  ): void {
    if (!isCurrent()) return;

    if (peer.connectionState === 'closed' || this.isHealthy(peer)) {
      this.forget(peerIdentityId);

      return;
    }

    if (this.inFlight.has(peerIdentityId)) return;

    const attempt = this.attempts.get(peerIdentityId) ?? 0;
    const delay = this.delay(peer, attempt);

    if (delay !== undefined) {
      const outcomeWait = Math.max(
        0,
        (this.retryNotBefore.get(peerIdentityId) ?? 0) - Date.now(),
      );
      this.schedule(
        peerIdentityId,
        peer,
        attempt,
        Math.max(delay, outcomeWait),
        isCurrent,
      );
    }
  }

  public reset(): void {
    this.inFlight.forEach((controller) => controller.abort());
    this.inFlight.clear();
    this.pending.forEach(({ timeout }) => clearTimeout(timeout));
    this.pending.clear();
    this.attempts.clear();
    this.retryNotBefore.clear();
  }
}
