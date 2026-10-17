import type { PeerLookup } from './PeerLookup';
import type { PeerNegotiationState } from './PeerNegotiationState';
import type { SignalSender } from './SignalSender';

import { logCallDebug, logCallWarning } from './callDebugLogger';
import { CallSignalRetry } from './CallSignalRetry';

const MAX_PENDING_CANDIDATES = 128;

export class CallIceCandidates {
  private readonly pending = new Map<string, RTCIceCandidateInit[]>();

  public constructor(
    private readonly peerFor: PeerLookup,
    private readonly signalRetry: CallSignalRetry,
  ) {}

  /**
   * Adds a candidate of the remote description's ICE generation and keeps one
   * of another generation pending. Signals arrive independently, so a remote
   * restart's candidates can precede the description that starts their
   * generation; candidates of an earlier generation never match again.
   */
  private async apply(
    peerIdentityId: string,
    peer: RTCPeerConnection,
    candidate: RTCIceCandidateInit,
  ): Promise<boolean> {
    const iceCandidate = new RTCIceCandidate(candidate);
    const remoteFragments = [
      ...(peer.remoteDescription?.sdp ?? '').matchAll(
        /^a=ice-ufrag:([^\r\n]+)$/gm,
      ),
    ].map((match) => match[1].trim());

    if (
      iceCandidate.usernameFragment &&
      remoteFragments.length > 0 &&
      !remoteFragments.includes(iceCandidate.usernameFragment)
    ) {
      this.queue(peerIdentityId, candidate);

      return false;
    }

    try {
      await peer.addIceCandidate(iceCandidate);
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'OperationError') {
        throw error;
      }
      logCallWarning('peer-manager:drop-incompatible-ice-candidate', {});
    }

    return true;
  }

  private queue(peerIdentityId: string, candidate: RTCIceCandidateInit): void {
    const candidates = this.pending.get(peerIdentityId) ?? [];

    candidates.push(candidate);

    if (candidates.length > MAX_PENDING_CANDIDATES) candidates.shift();
    this.pending.set(peerIdentityId, candidates);
    logCallDebug('peer-manager:queue-ice-candidate', {
      candidateCount: candidates.length,
      peerIdentityId,
    });
  }

  public async flush(
    peerIdentityId: string,
    peer: RTCPeerConnection,
  ): Promise<void> {
    const candidates = this.pending.get(peerIdentityId);

    if (!candidates?.length) return;

    this.pending.delete(peerIdentityId);
    logCallDebug('peer-manager:flush-ice-candidates', {
      candidateCount: candidates.length,
      peerIdentityId,
    });

    for (const candidate of candidates) {
      await this.apply(peerIdentityId, peer, candidate);
    }
  }

  public forget(peerIdentityId: string): void {
    this.pending.delete(peerIdentityId);
  }

  public async handleSignal(
    senderIdentityId: string,
    peer: RTCPeerConnection,
    candidate: RTCIceCandidateInit,
    state: PeerNegotiationState,
  ): Promise<void> {
    if (
      state.ignoreOffer ||
      peer.signalingState === 'have-local-offer' ||
      !peer.remoteDescription
    ) {
      logCallDebug('peer-manager:handle-signal:queue-ice-candidate', {
        senderIdentityId,
      });
      this.queue(senderIdentityId, candidate);

      return;
    }

    try {
      if (!(await this.apply(senderIdentityId, peer, candidate))) return;
    } catch (error) {
      if (state.ignoreOffer) return;

      throw error;
    }
    logCallDebug('peer-manager:handle-signal:added-ice-candidate', {
      senderIdentityId,
    });
  }

  public reset(): void {
    this.pending.clear();
  }

  public async send(
    peerIdentityId: string,
    peer: RTCPeerConnection,
    candidate: RTCIceCandidateInit,
    sendSignal: SignalSender,
  ): Promise<void> {
    const fragment =
      candidate.usernameFragment ??
      peer.localDescription?.sdp?.match(/^a=ice-ufrag:([^\r\n]+)/m)?.[1];

    await this.signalRetry.send(
      () => sendSignal(peerIdentityId, 'ice_candidate', { ...candidate }),
      () =>
        this.peerFor(peerIdentityId) === peer &&
        peer.connectionState !== 'closed' &&
        (fragment
          ? peer.localDescription?.sdp
              ?.split(/\r?\n/)
              .includes(`a=ice-ufrag:${fragment}`) === true
          : !peer.localDescription?.sdp?.includes('a=ice-ufrag:')),
    );
  }
}
