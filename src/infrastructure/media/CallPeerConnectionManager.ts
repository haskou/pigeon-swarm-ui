import type { CallSignalType } from '../../domain/calls/CallSession';

import { logCallDebug, logCallError, logCallWarning } from './callDebugLogger';

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

type BrowserWindowWithWebkitAudioContext = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

type SignalSender = (
  recipientIdentityId: string,
  signalType: CallSignalType,
  payload: Record<string, unknown>,
) => Promise<void>;

type PeerNegotiationState = {
  ignoreOffer: boolean;
  makingOffer: boolean;
  polite: boolean;
};

type DescriptionSignalPayload = RTCSessionDescriptionInit & {
  screenTrackIds?: string[];
};

function descriptionPayload(
  description: RTCSessionDescriptionInit,
  screenTrackIds: string[],
): Record<string, unknown> {
  return {
    screenTrackIds,
    sdp: description.sdp,
    type: description.type,
  };
}

function isScreenShareTrack(track: MediaStreamTrack): boolean {
  return track.kind === 'video' && track.contentHint === 'detail';
}

function isRemoteScreenShareTrack(
  track: MediaStreamTrack,
  remoteScreenTrackIds: Set<string>,
): boolean {
  if (track.kind !== 'video') return false;

  if (remoteScreenTrackIds.has(track.id)) return true;

  if (isScreenShareTrack(track)) return true;

  return /screen|display|window|tab|monitor/i.test(track.label);
}

export class CallPeerConnectionManager {
  private readonly peers = new Map<string, RTCPeerConnection>();

  private readonly peerNegotiationStates = new Map<
    string,
    PeerNegotiationState
  >();

  private readonly pendingIceCandidates = new Map<
    string,
    RTCIceCandidateInit[]
  >();

  private readonly remoteAudio = new Map<string, HTMLAudioElement>();

  private readonly remoteAudioContexts = new Map<string, AudioContext>();

  private readonly remoteAudioGains = new Map<string, GainNode>();

  private readonly remoteAudioVolumes = new Map<string, number>();

  private readonly remoteStreams = new Map<string, MediaStream>();

  private readonly remoteScreenStreams = new Map<string, MediaStream>();

  private readonly remoteScreenTrackIds = new Map<string, Set<string>>();

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
    this.syncLocalTracks();
  }

  public remoteMediaStreams(): Record<string, MediaStream> {
    return Object.fromEntries(this.remoteStreams.entries());
  }

  public remoteScreenMediaStreams(): Record<string, MediaStream> {
    return Object.fromEntries(this.remoteScreenStreams.entries());
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

  public setPeerVolume(peerIdentityId: string, volumePercent: number): void {
    const volume = Math.min(2.5, Math.max(0, volumePercent / 100));

    this.remoteAudioVolumes.set(peerIdentityId, volume);
    this.remoteAudioGains
      .get(peerIdentityId)
      ?.gain.setValueAtTime(
        volume,
        this.remoteAudioContexts.get(peerIdentityId)?.currentTime ?? 0,
      );

    const audio = this.remoteAudio.get(peerIdentityId);

    if (audio && !this.remoteAudioGains.has(peerIdentityId)) {
      audio.volume = Math.min(1, volume);
    }

    logCallDebug('peer-manager:set-peer-volume', {
      peerIdentityId,
      volumePercent,
    });
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
    this.configureNegotiationState(peerIdentityId, !shouldOffer);
    const peer = this.getOrCreatePeer(peerIdentityId, sendSignal);

    if (!shouldOffer || peer.localDescription) {
      logCallDebug('peer-manager:ensure-peer:offer-skipped', {
        hasLocalDescription: Boolean(peer.localDescription),
        peerIdentityId,
        shouldOffer,
      });

      return;
    }

    const state = this.peerNegotiationState(peerIdentityId);

    try {
      state.makingOffer = true;
      const offer = await peer.createOffer();

      await peer.setLocalDescription(offer);
      logCallDebug('peer-manager:ensure-peer:send-offer', {
        peerIdentityId,
      });
      await sendSignal(
        peerIdentityId,
        'offer',
        descriptionPayload(offer, this.localScreenTrackIds()),
      );
    } finally {
      state.makingOffer = false;
    }
  }

  public async handleSignal(
    senderIdentityId: string,
    signalType: CallSignalType,
    payload: Record<string, unknown>,
    sendSignal: SignalSender,
    currentIdentityId?: string,
  ): Promise<void> {
    logCallDebug('peer-manager:handle-signal', {
      senderIdentityId,
      signalType,
    });

    if (currentIdentityId) {
      this.configureNegotiationState(
        senderIdentityId,
        currentIdentityId > senderIdentityId,
      );
    }
    const peer = this.getOrCreatePeer(senderIdentityId, sendSignal);
    const state = this.peerNegotiationState(senderIdentityId);

    if (signalType === 'ice_candidate') {
      await this.handleIceCandidateSignal(
        senderIdentityId,
        peer,
        payload as RTCIceCandidateInit,
        state,
      );

      return;
    }

    await this.handleDescriptionSignal(
      senderIdentityId,
      peer,
      payload as unknown as DescriptionSignalPayload,
      state,
      sendSignal,
    );
  }

  public reset(): void {
    logCallDebug('peer-manager:reset', {
      peerCount: this.peers.size,
      remoteAudioCount: this.remoteAudio.size,
    });
    this.peers.forEach((peer) => peer.close());
    this.peers.clear();
    this.pendingIceCandidates.clear();
    this.peerNegotiationStates.clear();

    for (const audio of this.remoteAudio.values()) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    }
    for (const audioContext of this.remoteAudioContexts.values()) {
      void audioContext.close().catch(() => undefined);
    }
    this.remoteAudio.clear();
    this.remoteAudioContexts.clear();
    this.remoteAudioGains.clear();
    this.remoteAudioVolumes.clear();
    this.remoteStreams.clear();
    this.remoteScreenStreams.clear();
    this.remoteScreenTrackIds.clear();
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

  private async handleIceCandidateSignal(
    senderIdentityId: string,
    peer: RTCPeerConnection,
    candidate: RTCIceCandidateInit,
    state: PeerNegotiationState,
  ): Promise<void> {
    if (state.ignoreOffer) {
      logCallDebug('peer-manager:handle-signal:drop-ignored-ice-candidate', {
        senderIdentityId,
      });

      return;
    }

    if (!peer.remoteDescription) {
      logCallDebug('peer-manager:handle-signal:queue-ice-candidate', {
        senderIdentityId,
      });
      this.queueIceCandidate(senderIdentityId, candidate);

      return;
    }

    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      if (state.ignoreOffer) return;

      throw error;
    }
    logCallDebug('peer-manager:handle-signal:added-ice-candidate', {
      senderIdentityId,
    });
  }

  private async handleDescriptionSignal(
    senderIdentityId: string,
    peer: RTCPeerConnection,
    payload: DescriptionSignalPayload,
    state: PeerNegotiationState,
    sendSignal: SignalSender,
  ): Promise<void> {
    const description = new RTCSessionDescription(payload);

    if (
      !(await this.acceptRemoteDescription(
        senderIdentityId,
        peer,
        state,
        description,
      ))
    ) {
      return;
    }

    await peer.setRemoteDescription(description);
    this.rememberRemoteScreenTrackIds(senderIdentityId, payload.screenTrackIds);
    logCallDebug('peer-manager:handle-signal:remote-description-set', {
      screenTrackCount: payload.screenTrackIds?.length ?? 0,
      senderIdentityId,
      signalType: description.type,
    });
    await this.flushIceCandidates(senderIdentityId, peer);

    if (description.type !== 'offer') return;

    const answer = await peer.createAnswer();

    await peer.setLocalDescription(answer);
    logCallDebug('peer-manager:handle-signal:send-answer', {
      senderIdentityId,
    });
    await sendSignal(
      senderIdentityId,
      'answer',
      descriptionPayload(answer, this.localScreenTrackIds()),
    );
  }

  private async acceptRemoteDescription(
    senderIdentityId: string,
    peer: RTCPeerConnection,
    state: PeerNegotiationState,
    description: RTCSessionDescription,
  ): Promise<boolean> {
    const negotiationState = state;

    if (description.type !== 'offer') {
      negotiationState.ignoreOffer = false;

      return true;
    }

    const offerCollision =
      negotiationState.makingOffer || peer.signalingState !== 'stable';

    negotiationState.ignoreOffer = !negotiationState.polite && offerCollision;

    if (negotiationState.ignoreOffer) {
      logCallWarning('peer-manager:handle-signal:ignored-glare-offer', {
        senderIdentityId,
        signalingState: peer.signalingState,
      });

      return false;
    }

    negotiationState.ignoreOffer = false;

    if (offerCollision) {
      logCallDebug('peer-manager:handle-signal:rollback-glare-offer', {
        senderIdentityId,
        signalingState: peer.signalingState,
      });
      await peer.setLocalDescription({ type: 'rollback' });
    }

    return true;
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
      this.addLocalTracks(peer, peerIdentityId);
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
    peer.addEventListener('negotiationneeded', () => {
      void this.sendRenegotiationOffer(peerIdentityId, peer, sendSignal);
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

      this.handleRemoteTrack(peerIdentityId, event);
    });
    this.peers.set(peerIdentityId, peer);

    return peer;
  }

  private addLocalTracks(
    peer: RTCPeerConnection,
    peerIdentityId: string,
  ): void {
    this.localStream?.getTracks().forEach((track) => {
      logCallDebug('peer-manager:create-peer:add-local-track', {
        enabled: track.enabled,
        kind: track.kind,
        peerIdentityId,
        readyState: track.readyState,
      });

      peer.addTrack(track, this.localTrackStream(track));
    });
  }

  private localTrackStream(track: MediaStreamTrack): MediaStream {
    if (isScreenShareTrack(track)) return new MediaStream([track]);

    return this.localStream ?? new MediaStream([track]);
  }

  private localScreenTrackIds(): string[] {
    return (
      this.localStream
        ?.getVideoTracks()
        .filter((track) => isScreenShareTrack(track))
        .map((track) => track.id) ?? []
    );
  }

  private rememberRemoteScreenTrackIds(
    peerIdentityId: string,
    screenTrackIds?: string[],
  ): void {
    this.remoteScreenTrackIds.set(
      peerIdentityId,
      new Set(screenTrackIds ?? []),
    );
  }

  private configureNegotiationState(
    peerIdentityId: string,
    polite: boolean,
  ): void {
    const current = this.peerNegotiationState(peerIdentityId);

    current.polite = polite;
  }

  private peerNegotiationState(peerIdentityId: string): PeerNegotiationState {
    const current = this.peerNegotiationStates.get(peerIdentityId);

    if (current) return current;

    const state = {
      ignoreOffer: false,
      makingOffer: false,
      polite: true,
    };

    this.peerNegotiationStates.set(peerIdentityId, state);

    return state;
  }

  private handleRemoteTrack(
    peerIdentityId: string,
    event: RTCTrackEvent,
  ): void {
    const [receivedStream] = event.streams;
    const stream = receivedStream ?? new MediaStream([event.track]);

    if (
      isRemoteScreenShareTrack(
        event.track,
        this.remoteScreenTrackIds.get(peerIdentityId) ?? new Set(),
      )
    ) {
      const screenStream = new MediaStream([event.track]);

      this.remoteScreenStreams.set(peerIdentityId, screenStream);
      event.track.addEventListener('ended', () => {
        if (this.remoteScreenStreams.get(peerIdentityId) === screenStream) {
          this.remoteScreenStreams.delete(peerIdentityId);
        }
      });
      logCallDebug('peer-manager:screen-track-received', {
        peerIdentityId,
        trackId: event.track.id,
      });

      return;
    }

    this.remoteStreams.set(peerIdentityId, stream);
    this.playRemoteStream(peerIdentityId, stream);
  }

  private syncLocalTracks(): void {
    for (const [peerIdentityId, peer] of this.peers.entries()) {
      const activeTracks = new Set(this.localStream?.getTracks() ?? []);

      for (const sender of peer.getSenders()) {
        const track = sender.track;

        if (track && !activeTracks.has(track)) {
          void sender.replaceTrack(null).catch((error: unknown) => {
            logCallError('peer-manager:replace-track:remove-failed', error, {
              peerIdentityId,
            });
          });
        }
      }

      this.localStream?.getTracks().forEach((track) => {
        const existing = peer
          .getSenders()
          .some((sender) => sender.track?.id === track.id);

        if (!existing && this.localStream)
          peer.addTrack(track, this.localTrackStream(track));
      });
    }
  }

  private async sendRenegotiationOffer(
    peerIdentityId: string,
    peer: RTCPeerConnection,
    sendSignal: SignalSender,
  ): Promise<void> {
    if (peer.signalingState !== 'stable') return;

    const state = this.peerNegotiationState(peerIdentityId);

    try {
      state.makingOffer = true;
      const offer = await peer.createOffer();

      await peer.setLocalDescription(offer);
      await sendSignal(
        peerIdentityId,
        'offer',
        descriptionPayload(offer, this.localScreenTrackIds()),
      );
    } finally {
      state.makingOffer = false;
    }
  }

  private playRemoteStream(peerIdentityId: string, stream: MediaStream): void {
    const audio =
      this.remoteAudio.get(peerIdentityId) ?? document.createElement('audio');

    audio.autoplay = true;
    audio.muted = this.deafened;
    audio.srcObject = stream;
    this.connectRemoteAudioOutput(peerIdentityId, audio);
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

  private connectRemoteAudioOutput(
    peerIdentityId: string,
    audio: HTMLAudioElement,
  ): void {
    const volume = this.remoteAudioVolumes.get(peerIdentityId) ?? 1;

    if (this.remoteAudioGains.has(peerIdentityId)) {
      this.remoteAudioGains
        .get(peerIdentityId)
        ?.gain.setValueAtTime(
          volume,
          this.remoteAudioContexts.get(peerIdentityId)?.currentTime ?? 0,
        );

      return;
    }

    const AudioContextConstructor =
      window.AudioContext ??
      (window as BrowserWindowWithWebkitAudioContext).webkitAudioContext;

    if (!AudioContextConstructor) {
      const remoteAudio = audio;

      remoteAudio.volume = Math.min(1, volume);

      return;
    }

    try {
      const audioContext = new AudioContextConstructor();
      const source = audioContext.createMediaElementSource(audio);
      const gain = audioContext.createGain();

      gain.gain.value = volume;
      source.connect(gain).connect(audioContext.destination);
      this.remoteAudioContexts.set(peerIdentityId, audioContext);
      this.remoteAudioGains.set(peerIdentityId, gain);
      void audioContext.resume().catch(() => undefined);
    } catch (error) {
      const remoteAudio = audio;

      remoteAudio.volume = Math.min(1, volume);
      logCallError('peer-manager:remote-audio:gain-setup-failed', error, {
        peerIdentityId,
      });
    }
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
