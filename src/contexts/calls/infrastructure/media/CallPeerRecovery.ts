import type { CallPeerRecoveryState } from './CallPeerRecoveryState';

import { logCallWarning } from './callDebugLogger';
import { CallPeerRestartError } from './CallPeerRestartError';

const disconnectedPeerRecoveryDelayMs = 3_000;
const maximumPeerRecoveryDelayMs = 15_000;
const checkingPeerRecoveryDelayMs = 15_000;
const maximumPeerRecoveryAttempts = 3;
const peerRestartOutcomeWaitMs = 15_000;
const credentialRefreshTimeoutMs = 15_000;
const disruptionCooldownMs = 5_000;
const politeDisruptionDelayMs = 3_000;

/**
 * Three recovery attempts may each replace both ends' connection once, with
 * room to spare. Beyond it a peer is changing its DTLS certificate, or
 * signalling again after every refusal, for the sake of it: every rebuilt
 * connection costs a configuration fetch and a relay allocation.
 */
const maximumPeerReplacements = 10;

export class CallPeerRecovery {
  private readonly exhausted = new Set<string>();

  private readonly inFlight = new Map<string, AbortController>();

  private readonly attempts = new Map<string, number>();

  private readonly pending = new Map<
    string,
    { deadline: number; timeout: ReturnType<typeof setTimeout> }
  >();

  private readonly retryNotBefore = new Map<string, number>();

  private readonly replacements = new Map<string, number>();

  private readonly lastRestartAt = new Map<string, number>();

  public constructor(
    private readonly restartIce: (
      peerIdentityId: string,
      peer: RTCPeerConnection,
      canRestart: () => boolean,
    ) => Promise<void>,
    private readonly replaceConnection: (
      peerIdentityId: string,
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
    if (attempt >= maximumPeerRecoveryAttempts) return 0;

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

    if (this.isNegotiating(peer)) {
      return checkingPeerRecoveryDelayMs;
    }

    return undefined;
  }

  /**
   * A peer still connecting is negotiating: ICE that never left `new` may
   * wait for an offer that never arrives, and DTLS may never finish after
   * ICE connected. Neither may look like "Connecting" forever.
   */
  private isNegotiating(peer: RTCPeerConnection): boolean {
    return (
      peer.connectionState === 'connecting' ||
      peer.iceConnectionState === 'new' ||
      peer.iceConnectionState === 'checking' ||
      peer.signalingState === 'have-local-offer'
    );
  }

  private isHealthy(peer: RTCPeerConnection): boolean {
    return (
      peer.connectionState === 'connected' &&
      (peer.iceConnectionState === 'connected' ||
        peer.iceConnectionState === 'completed')
    );
  }

  /**
   * ICE connected while DTLS never finished. Restarting ICE keeps that DTLS
   * transport, so such a connection must be replaced instead.
   */
  private isStalledInDtls(peer: RTCPeerConnection): boolean {
    return (
      peer.connectionState === 'connecting' &&
      (peer.iceConnectionState === 'connected' ||
        peer.iceConnectionState === 'completed')
    );
  }

  private isFinished(peer: RTCPeerConnection): boolean {
    return peer.connectionState === 'closed' || this.isHealthy(peer);
  }

  private failureEvent(error: unknown): string {
    if (!(error instanceof CallPeerRestartError))
      return 'peer-manager:ice-recovery:restart-failed';

    return {
      configuration: 'peer-manager:ice-recovery:configuration-unavailable',
      'ice-restart': 'peer-manager:ice-recovery:restart-failed',
      signal: 'peer-manager:ice-recovery:offer-undelivered',
    }[error.stage];
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
      attempt: Math.min(attempt + 1, maximumPeerRecoveryAttempts),
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

      if (attempt >= maximumPeerRecoveryAttempts) {
        this.exhausted.add(peerIdentityId);
        logCallWarning('peer-manager:ice-recovery:exhausted');

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
    this.lastRestartAt.set(peerIdentityId, Date.now());
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
      const action = this.isStalledInDtls(peer)
        ? this.replaceConnection(peerIdentityId, canRestart)
        : this.restartIce(peerIdentityId, peer, canRestart);

      await Promise.race([action, cancelled]);
    } catch (error) {
      logCallWarning(this.failureEvent(error), { attempt: attempt + 1 });
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

  private release(peerIdentityId: string): void {
    this.abandon(peerIdentityId);
    this.replacements.delete(peerIdentityId);
  }

  private isDisruptable(
    peerIdentityId: string,
    peer: RTCPeerConnection,
    isCurrent: () => boolean,
  ): boolean {
    return (
      isCurrent() &&
      peer.connectionState !== 'closed' &&
      !this.isHealthy(peer) &&
      Boolean(peer.localDescription && peer.remoteDescription) &&
      !this.inFlight.has(peerIdentityId)
    );
  }

  /**
   * Stops the work aimed at a connection that is being replaced. The restart
   * budget stays with the peer: a glare is no sign of a healthier network,
   * and a budget that reset with every replacement would never run out.
   */
  public detach(peerIdentityId: string): void {
    this.cancel(peerIdentityId);
    this.inFlight.get(peerIdentityId)?.abort();
    this.inFlight.delete(peerIdentityId);
  }

  /**
   * Drops the recovery of a peer whose connection is removed. Its rebuilt
   * connections stay counted: a peer that is refused and signals again would
   * otherwise get a fresh connection, and a fresh budget, with every signal.
   */
  public abandon(peerIdentityId: string): void {
    this.detach(peerIdentityId);
    this.attempts.delete(peerIdentityId);
    this.exhausted.delete(peerIdentityId);
    this.retryNotBefore.delete(peerIdentityId);
  }

  /**
   * Whether a connection may be rebuilt for a peer once more, by replacing
   * the one it has or by creating it again after it was removed. The
   * rebuilds of a peer are counted until one of its connections turns
   * healthy, the user retries or the peer leaves the call; past the limit the
   * peer is given up as exhausted and keeps the connection it has.
   */
  public allowReplacement(peerIdentityId: string): boolean {
    const replacements = (this.replacements.get(peerIdentityId) ?? 0) + 1;

    if (replacements > maximumPeerReplacements) {
      this.detach(peerIdentityId);
      this.exhausted.add(peerIdentityId);
      logCallWarning('peer-manager:ice-recovery:replacement-limit');

      return false;
    }

    this.replacements.set(peerIdentityId, replacements);

    return true;
  }

  public forget(peerIdentityId: string): void {
    this.release(peerIdentityId);
    this.lastRestartAt.delete(peerIdentityId);
  }

  /** Forgets the peers that are no longer in the call. */
  public retain(peerIdentityIds: Set<string>): void {
    for (const peerIdentityId of this.replacements.keys()) {
      if (!peerIdentityIds.has(peerIdentityId)) {
        this.forget(peerIdentityId);
      }
    }
  }

  public reconcile(
    peerIdentityId: string,
    peer: RTCPeerConnection,
    isCurrent: () => boolean,
  ): void {
    if (!isCurrent()) return;

    if (this.isFinished(peer)) {
      this.release(peerIdentityId);

      return;
    }

    if (this.inFlight.has(peerIdentityId) || this.exhausted.has(peerIdentityId))
      return;

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

  /**
   * Starts a fresh recovery after an external disruption (a network path change
   * or a restored signaling connection). Only negotiated, unhealthy peers are
   * restarted, and the restart budget is reset because the cause is external.
   * Restarts are spaced by `disruptionCooldownMs` so a flapping network cannot
   * restart a peer in a storm.
   *
   * A disruption usually reaches both peers at once. The impolite peer restarts
   * immediately and the polite peer waits for that offer: had both offered,
   * the polite peer would have to replace its whole connection to answer, for
   * Chromium and WebKit never run the frame transforms of one that rolled back.
   */
  public disrupt(
    peerIdentityId: string,
    peer: RTCPeerConnection,
    polite: boolean,
    isCurrent: () => boolean,
  ): void {
    if (!this.isDisruptable(peerIdentityId, peer, isCurrent)) return;

    const lastRestart = this.lastRestartAt.get(peerIdentityId);

    if (
      lastRestart !== undefined &&
      Date.now() - lastRestart < disruptionCooldownMs
    ) {
      this.reconcile(peerIdentityId, peer, isCurrent);

      return;
    }

    this.release(peerIdentityId);
    logCallWarning('peer-manager:ice-recovery:disruption');
    this.schedule(
      peerIdentityId,
      peer,
      0,
      polite ? politeDisruptionDelayMs : 0,
      isCurrent,
    );
  }

  public stateFor(peerIdentityId: string): CallPeerRecoveryState {
    if (this.exhausted.has(peerIdentityId)) return 'exhausted';

    return this.inFlight.has(peerIdentityId) ||
      this.attempts.has(peerIdentityId)
      ? 'recovering'
      : 'idle';
  }

  public retry(
    peerIdentityId: string,
    peer: RTCPeerConnection,
    isCurrent: () => boolean,
  ): void {
    if (
      !isCurrent() ||
      !this.exhausted.has(peerIdentityId) ||
      peer.connectionState === 'closed' ||
      this.isHealthy(peer)
    )
      return;

    this.release(peerIdentityId);
    logCallWarning('peer-manager:ice-recovery:manual-retry');
    this.schedule(peerIdentityId, peer, 0, 0, isCurrent);
  }

  public reset(): void {
    this.inFlight.forEach((controller) => controller.abort());
    this.inFlight.clear();
    this.pending.forEach(({ timeout }) => clearTimeout(timeout));
    this.pending.clear();
    this.attempts.clear();
    this.exhausted.clear();
    this.replacements.clear();
    this.retryNotBefore.clear();
    this.lastRestartAt.clear();
  }
}
