import { logCallWarning } from './callDebugLogger';

const disconnectedPeerRecoveryDelayMs = 3_000;
const maximumPeerRecoveryDelayMs = 15_000;

export class CallPeerRecovery {
  private readonly attempts = new Map<string, number>();

  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();

  private cancel(peerIdentityId: string): void {
    const timeout = this.pending.get(peerIdentityId);

    if (timeout === undefined) return;

    clearTimeout(timeout);
    this.pending.delete(peerIdentityId);
  }

  private delay(peer: RTCPeerConnection, attempt: number): number | undefined {
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
    if (this.pending.has(peerIdentityId)) return;

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

      this.attempts.set(peerIdentityId, attempt + 1);
      logCallWarning('peer-manager:ice-recovery:restart', {
        attempt: attempt + 1,
        peerIdentityId,
      });
      peer.restartIce();
    }, delay);

    this.pending.set(peerIdentityId, timeout);
  }

  public forget(peerIdentityId: string): void {
    this.cancel(peerIdentityId);
    this.attempts.delete(peerIdentityId);
  }

  public reconcile(
    peerIdentityId: string,
    peer: RTCPeerConnection,
    isCurrent: () => boolean,
  ): void {
    if (this.isHealthy(peer)) {
      this.forget(peerIdentityId);

      return;
    }

    const attempt = this.attempts.get(peerIdentityId) ?? 0;
    const delay = this.delay(peer, attempt);

    if (delay !== undefined) {
      this.schedule(peerIdentityId, peer, attempt, delay, isCurrent);
    }
  }

  public reset(): void {
    this.pending.forEach((timeout) => clearTimeout(timeout));
    this.pending.clear();
    this.attempts.clear();
  }
}
