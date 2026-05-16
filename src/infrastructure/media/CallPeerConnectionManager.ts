import type { CallSignalType } from '../../domain/calls/CallSession';
import {
  logCallDebug,
  logCallError,
  logCallWarning,
} from './callDebugLogger';

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
    logCallDebug('peer-manager:configure', {
      iceServerCount: rtcConfiguration.iceServers?.length ?? 0,
    });
  }

  public setLocalStream(stream: MediaStream | null): void {
    this.localStream = stream;
    logCallDebug('peer-manager:set-local-stream', {
      hasStream: Boolean(stream),
      tracks:
        stream?.getTracks().map((track) => ({
          enabled: track.enabled,
          id: track.id,
          kind: track.kind,
          label: track.label,
          muted: track.muted,
          readyState: track.readyState,
        })) ?? [],
    });
  }

  public setDeafened(deafened: boolean): void {
    this.deafened = deafened;
    logCallDebug('peer-manager:set-deafened', {
      deafened,
      remoteAudioCount: this.remoteAudio.size,
    });

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
    logCallDebug('peer-manager:ensure-peer', {
      hasExistingPeer: this.peers.has(peerIdentityId),
      peerIdentityId,
      shouldOffer,
    });
    const peer = this.getOrCreatePeer(peerIdentityId, sendSignal);

    if (!shouldOffer || peer.localDescription) {
      logCallDebug('peer-manager:ensure-peer:offer-skipped', {
        hasLocalDescription: Boolean(peer.localDescription),
        peerIdentityId,
        shouldOffer,
      });
      return;
    }

    const offer = await peer.createOffer();

    await peer.setLocalDescription(offer);
    logCallDebug('peer-manager:ensure-peer:send-offer', {
      peerIdentityId,
    });
    await sendSignal(peerIdentityId, 'offer', descriptionPayload(offer));
  }

  public async handleSignal(
    senderIdentityId: string,
    signalType: CallSignalType,
    payload: Record<string, unknown>,
    sendSignal: SignalSender,
  ): Promise<void> {
    logCallDebug('peer-manager:handle-signal', {
      senderIdentityId,
      signalType,
    });
    const peer = this.getOrCreatePeer(senderIdentityId, sendSignal);

    if (signalType === 'ice_candidate') {
      if (!peer.remoteDescription) {
        logCallDebug('peer-manager:handle-signal:queue-ice-candidate', {
          senderIdentityId,
        });
        this.queueIceCandidate(
          senderIdentityId,
          payload as RTCIceCandidateInit,
        );

        return;
      }

      await peer.addIceCandidate(
        new RTCIceCandidate(payload as RTCIceCandidateInit),
      );
      logCallDebug('peer-manager:handle-signal:added-ice-candidate', {
        senderIdentityId,
      });

      return;
    }

    const description = new RTCSessionDescription(
      payload as unknown as RTCSessionDescriptionInit,
    );

    await peer.setRemoteDescription(description);
    logCallDebug('peer-manager:handle-signal:remote-description-set', {
      senderIdentityId,
      signalType,
    });
    await this.flushIceCandidates(senderIdentityId, peer);

    if (signalType !== 'offer') return;

    const answer = await peer.createAnswer();

    await peer.setLocalDescription(answer);
    logCallDebug('peer-manager:handle-signal:send-answer', {
      senderIdentityId,
    });
    await sendSignal(senderIdentityId, 'answer', descriptionPayload(answer));
  }

  public reset(): void {
    logCallDebug('peer-manager:reset', {
      peerCount: this.peers.size,
      remoteAudioCount: this.remoteAudio.size,
    });
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
      logCallError(
        'peer-manager:create-peer:missing-rtc-configuration',
        new Error('RTCPeerConnection configuration is not loaded.'),
        { peerIdentityId },
      );
      throw new Error('RTCPeerConnection configuration is not loaded.');
    }

    const peer = new RTCPeerConnection(this.rtcConfiguration);
    logCallDebug('peer-manager:create-peer', {
      hasLocalStream: Boolean(this.localStream),
      peerIdentityId,
    });

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        logCallDebug('peer-manager:create-peer:add-local-track', {
          enabled: track.enabled,
          kind: track.kind,
          peerIdentityId,
          readyState: track.readyState,
        });
        if (this.localStream) peer.addTrack(track, this.localStream);
      });
    } else {
      logCallWarning('peer-manager:create-peer:recvonly-no-local-stream', {
        peerIdentityId,
      });
      peer.addTransceiver('audio', { direction: 'recvonly' });
    }
    peer.addEventListener('connectionstatechange', () => {
      logCallDebug('peer-manager:connection-state-change', {
        connectionState: peer.connectionState,
        peerIdentityId,
      });
    });
    peer.addEventListener('iceconnectionstatechange', () => {
      logCallDebug('peer-manager:ice-connection-state-change', {
        iceConnectionState: peer.iceConnectionState,
        peerIdentityId,
      });
    });
    peer.addEventListener('signalingstatechange', () => {
      logCallDebug('peer-manager:signaling-state-change', {
        peerIdentityId,
        signalingState: peer.signalingState,
      });
    });
    peer.addEventListener('icecandidate', (event) => {
      if (!event.candidate) {
        logCallDebug('peer-manager:ice-candidate:gathering-complete', {
          peerIdentityId,
        });
        return;
      }

      logCallDebug('peer-manager:ice-candidate:send', {
        candidateType: event.candidate.type,
        peerIdentityId,
      });
      void sendSignal(peerIdentityId, 'ice_candidate', {
        ...event.candidate.toJSON(),
      });
    });
    peer.addEventListener('track', (event) => {
      const [stream] = event.streams;

      logCallDebug('peer-manager:track-received', {
        hasStream: Boolean(stream),
        peerIdentityId,
        trackCount: event.streams.reduce(
          (count, currentStream) => count + currentStream.getTracks().length,
          0,
        ),
      });
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
    logCallDebug('peer-manager:remote-audio:play-requested', {
      deafened: this.deafened,
      peerIdentityId,
      trackCount: stream.getTracks().length,
    });

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

    void audio.play().catch((error: unknown) => {
      logCallError('peer-manager:remote-audio:play-failed', error, {
        peerIdentityId,
      });
    });
  }

  private async flushIceCandidates(
    peerIdentityId: string,
    peer: RTCPeerConnection,
  ): Promise<void> {
    const candidates = this.pendingIceCandidates.get(peerIdentityId);

    if (!candidates?.length) return;

    this.pendingIceCandidates.delete(peerIdentityId);
    logCallDebug('peer-manager:flush-ice-candidates', {
      candidateCount: candidates.length,
      peerIdentityId,
    });

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
    logCallDebug('peer-manager:queue-ice-candidate', {
      candidateCount: candidates.length,
      peerIdentityId,
    });
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
