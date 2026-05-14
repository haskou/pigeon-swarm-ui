import type { CallSignalType } from '../../domain/calls/CallSession';

export type PeerMediaStats = {
  audioLevel?: number;
  connectionState: RTCPeerConnectionState;
  latencyMs?: number;
  packetsLost?: number;
  speaking: boolean;
};

type AudioInboundStats = {
  audioLevel?: number;
  packetsLost?: number;
};

type CandidatePairStats = {
  latencyMs?: number;
};

type BrowserRtcStats = RTCStats & {
  audioLevel?: unknown;
  currentRoundTripTime?: unknown;
  kind?: unknown;
  packetsLost?: unknown;
  state?: unknown;
};

type SignalSender = (
  recipientIdentityId: string,
  signalType: CallSignalType,
  payload: Record<string, unknown>,
) => Promise<void>;

function descriptionPayload(
  description: RTCSessionDescriptionInit,
): Record<string, unknown> {
  return {
    sdp: description.sdp,
    type: description.type,
  };
}

export class CallPeerConnectionManager {
  private readonly peers = new Map<string, RTCPeerConnection>();

  private readonly pendingIceCandidates = new Map<
    string,
    RTCIceCandidateInit[]
  >();

  private readonly remoteAudio = new Map<string, HTMLAudioElement>();

  private localStream: MediaStream | null = null;

  private rtcConfiguration: RTCConfiguration | null = null;

  private deafened = false;

  public configure(rtcConfiguration: RTCConfiguration): void {
    this.rtcConfiguration = rtcConfiguration;
  }

  public setLocalStream(stream: MediaStream | null): void {
    this.localStream = stream;
  }

  public setDeafened(deafened: boolean): void {
    this.deafened = deafened;

    for (const audio of this.remoteAudio.values()) {
      audio.muted = deafened;

      if (deafened) {
        audio.pause();
      } else {
        void audio.play().catch(() => undefined);
      }
    }
  }

  public async ensurePeer(
    peerIdentityId: string,
    shouldOffer: boolean,
    sendSignal: SignalSender,
  ): Promise<void> {
    const peer = this.getOrCreatePeer(peerIdentityId, sendSignal);

    if (!shouldOffer || peer.localDescription) return;

    const offer = await peer.createOffer();

    await peer.setLocalDescription(offer);
    await sendSignal(peerIdentityId, 'offer', descriptionPayload(offer));
  }

  public async handleSignal(
    senderIdentityId: string,
    signalType: CallSignalType,
    payload: Record<string, unknown>,
    sendSignal: SignalSender,
  ): Promise<void> {
    const peer = this.getOrCreatePeer(senderIdentityId, sendSignal);

    if (signalType === 'ice_candidate') {
      if (!peer.remoteDescription) {
        this.queueIceCandidate(
          senderIdentityId,
          payload as RTCIceCandidateInit,
        );

        return;
      }

      await peer.addIceCandidate(
        new RTCIceCandidate(payload as RTCIceCandidateInit),
      );

      return;
    }

    const description = new RTCSessionDescription(
      payload as unknown as RTCSessionDescriptionInit,
    );

    await peer.setRemoteDescription(description);
    await this.flushIceCandidates(senderIdentityId, peer);

    if (signalType !== 'offer') return;

    const answer = await peer.createAnswer();

    await peer.setLocalDescription(answer);
    await sendSignal(senderIdentityId, 'answer', descriptionPayload(answer));
  }

  public reset(): void {
    this.peers.forEach((peer) => peer.close());
    this.peers.clear();
    this.pendingIceCandidates.clear();

    for (const audio of this.remoteAudio.values()) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    }
    this.remoteAudio.clear();
    this.localStream = null;
    this.rtcConfiguration = null;
    this.deafened = false;
  }

  public async collectStats(): Promise<Record<string, PeerMediaStats>> {
    const entries = await Promise.all(
      [...this.peers.entries()].map(
        async ([identityId, peer]): Promise<[string, PeerMediaStats]> => [
          identityId,
          await this.collectPeerStats(peer),
        ],
      ),
    );
    const stats: Record<string, PeerMediaStats> = {};

    for (const [identityId, peerStats] of entries) {
      stats[identityId] = peerStats;
    }

    return stats;
  }

  private getOrCreatePeer(
    peerIdentityId: string,
    sendSignal: SignalSender,
  ): RTCPeerConnection {
    const existing = this.peers.get(peerIdentityId);

    if (existing) return existing;

    if (!this.rtcConfiguration) {
      throw new Error('RTCPeerConnection configuration is not loaded.');
    }

    const peer = new RTCPeerConnection(this.rtcConfiguration);

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (this.localStream) peer.addTrack(track, this.localStream);
      });
    } else {
      peer.addTransceiver('audio', { direction: 'recvonly' });
    }
    peer.addEventListener('icecandidate', (event) => {
      if (!event.candidate) return;

      void sendSignal(peerIdentityId, 'ice_candidate', {
        ...event.candidate.toJSON(),
      });
    });
    peer.addEventListener('track', (event) => {
      const [stream] = event.streams;

      if (stream) this.playRemoteStream(peerIdentityId, stream);
    });
    this.peers.set(peerIdentityId, peer);

    return peer;
  }

  private playRemoteStream(peerIdentityId: string, stream: MediaStream): void {
    const audio =
      this.remoteAudio.get(peerIdentityId) ?? document.createElement('audio');

    audio.autoplay = true;
    audio.muted = this.deafened;
    audio.srcObject = stream;

    if (!this.remoteAudio.has(peerIdentityId)) {
      audio.dataset.peerIdentityId = peerIdentityId;
      audio.className = 'hidden';
      document.body.append(audio);
      this.remoteAudio.set(peerIdentityId, audio);
    }

    if (this.deafened) {
      audio.pause();

      return;
    }

    void audio.play().catch(() => undefined);
  }

  private async flushIceCandidates(
    peerIdentityId: string,
    peer: RTCPeerConnection,
  ): Promise<void> {
    const candidates = this.pendingIceCandidates.get(peerIdentityId);

    if (!candidates?.length) return;

    this.pendingIceCandidates.delete(peerIdentityId);

    for (const candidate of candidates) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private queueIceCandidate(
    peerIdentityId: string,
    candidate: RTCIceCandidateInit,
  ): void {
    const candidates = this.pendingIceCandidates.get(peerIdentityId) ?? [];

    candidates.push(candidate);
    this.pendingIceCandidates.set(peerIdentityId, candidates);
  }

  private async collectPeerStats(
    peer: RTCPeerConnection,
  ): Promise<PeerMediaStats> {
    const reports = await peer.getStats();
    let audioLevel: number | undefined;
    let latencyMs: number | undefined;
    let packetsLost: number | undefined;

    reports.forEach((report) => {
      const statsReport = report as unknown as RTCStats;
      const inbound = this.audioInboundStats(statsReport);
      const candidatePair = this.candidatePairStats(statsReport);

      if (inbound.audioLevel !== undefined) {
        audioLevel = Math.max(audioLevel ?? 0, inbound.audioLevel);
      }

      if (inbound.packetsLost !== undefined) packetsLost = inbound.packetsLost;

      if (candidatePair.latencyMs !== undefined) {
        latencyMs = candidatePair.latencyMs;
      }
    });

    return {
      audioLevel,
      connectionState: peer.connectionState,
      latencyMs,
      packetsLost,
      speaking: (audioLevel ?? 0) > 0.04,
    };
  }

  private audioInboundStats(report: RTCStats): AudioInboundStats {
    const stats = report as BrowserRtcStats;

    if (stats.type !== 'inbound-rtp' || stats.kind !== 'audio') return {};

    return {
      audioLevel:
        typeof stats.audioLevel === 'number' ? stats.audioLevel : undefined,
      packetsLost:
        typeof stats.packetsLost === 'number' ? stats.packetsLost : undefined,
    };
  }

  private candidatePairStats(report: RTCStats): CandidatePairStats {
    const stats = report as BrowserRtcStats;

    if (
      stats.type !== 'candidate-pair' ||
      stats.state !== 'succeeded' ||
      typeof stats.currentRoundTripTime !== 'number'
    ) {
      return {};
    }

    return {
      latencyMs: Math.round(stats.currentRoundTripTime * 1000),
    };
  }
}
