import type {
  CallSignalType,
  ScreenShareQualityPreset,
} from '../../domain/callSession.types';
import type { BrowserWindowWithWebkitAudioContext } from './BrowserWindowWithWebkitAudioContext';
import type { PeerNegotiationState } from './PeerNegotiationState';

import { logCallDebug, logCallError, logCallWarning } from './callDebugLogger';
import {
  hasAudioTrack,
  isRemoteScreenShareAudioTrack,
  isRemoteScreenShareTrack,
  isScreenShareAudioTrack,
  isScreenShareTrack,
  replacementLocalTrack,
} from './callMediaTrackClassification';
import {
  collectPeerMediaStats,
  type PeerMediaStats,
} from './collectPeerMediaStats';
import {
  descriptionPayload,
  type DescriptionSignalPayload,
  type SignalSender,
} from './descriptionPayload';
import {
  graphAudioVolume,
  isMediaStreamSource,
  nativeAudioVolume,
  needsAudioGraph,
  remoteAudioKey,
} from './remoteAudioOutput';
import { screenShareEncodingParameters } from './ScreenShareQuality';

export type { PeerMediaStats } from './collectPeerMediaStats';

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

  private readonly remoteAudioOutputSources = new Map<
    string,
    MediaStreamAudioSourceNode
  >();

  private readonly remoteAudioOutputStreams = new Map<string, MediaStream>();

  private readonly remoteAudioStreams = new Map<string, MediaStream>();

  private readonly remoteAudioVolumes = new Map<string, number>();

  private readonly remoteStreams = new Map<string, MediaStream>();

  private readonly remoteScreenStreams = new Map<string, MediaStream>();

  private readonly remoteScreenStreamIds = new Map<string, Set<string>>();

  private readonly remoteScreenTrackIds = new Map<string, Set<string>>();

  private readonly remoteScreenAudioStreamIds = new Map<string, Set<string>>();

  private readonly remoteScreenAudioTrackIds = new Map<string, Set<string>>();

  private readonly localScreenStreams = new Map<string, MediaStream>();

  private readonly previousStatsSamples = new Map<
    string,
    { bytesReceived: number; sampledAt: number }
  >();

  private localStream: MediaStream | null = null;

  private rtcConfiguration: RTCConfiguration | null = null;

  private deafened = false;

  private screenShareQuality: ScreenShareQualityPreset = 'auto';

  private setRemoteAudioChannelVolume(
    audioKey: string,
    volumePercent: number,
  ): void {
    const volume = Math.min(3, Math.max(0, volumePercent / 100));

    this.remoteAudioVolumes.set(audioKey, volume);
    const audio = this.remoteAudio.get(audioKey);
    const gain = this.remoteAudioGains.get(audioKey);

    if (audio) {
      if (isMediaStreamSource(audio.srcObject)) {
        this.syncRemoteAudioOutput(audioKey, audio.srcObject, volume);
      }

      audio.volume =
        gain || this.remoteAudioGains.has(audioKey)
          ? 0
          : nativeAudioVolume(volume);
    }

    this.applyRemoteAudioOutputVolume(audioKey, volume);
  }

  private bitrateFor(
    identityId: string,
    stats: PeerMediaStats,
  ): number | undefined {
    if (stats.bytesReceived === undefined) return undefined;

    const sampledAt = Date.now();
    const previous = this.previousStatsSamples.get(identityId);

    this.previousStatsSamples.set(identityId, {
      bytesReceived: stats.bytesReceived,
      sampledAt,
    });

    if (!previous) return undefined;

    const elapsedSeconds = (sampledAt - previous.sampledAt) / 1000;
    const bytesDelta = stats.bytesReceived - previous.bytesReceived;

    if (elapsedSeconds <= 0 || bytesDelta < 0) return undefined;

    return Math.round((bytesDelta * 8) / elapsedSeconds / 1000);
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

    this.rememberRemoteScreenShareMetadata(senderIdentityId, payload);
    await peer.setRemoteDescription(description);
    logCallDebug('peer-manager:handle-signal:remote-description-set', {
      screenStreamCount: payload.screenStreamIds?.length ?? 0,
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
      descriptionPayload(
        answer,
        this.localScreenAudioTrackIds(),
        this.localScreenAudioStreamIds(),
        this.localScreenTrackIds(),
        this.localScreenStreamIds(),
      ),
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

      this.configureLocalSender(
        peer.addTrack(track, this.localTrackStream(track)),
      );
    });
  }

  private localTrackStream(track: MediaStreamTrack): MediaStream {
    if (isScreenShareTrack(track) || isScreenShareAudioTrack(track)) {
      const currentStream = this.localScreenStreams.get(track.id);

      if (currentStream) return currentStream;

      const screenStream = new MediaStream([track]);

      this.localScreenStreams.set(track.id, screenStream);

      return screenStream;
    }

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

  private localScreenAudioTrackIds(): string[] {
    return (
      this.localStream
        ?.getAudioTracks()
        .filter((track) => isScreenShareAudioTrack(track))
        .map((track) => track.id) ?? []
    );
  }

  private localScreenStreamIds(): string[] {
    return this.localMediaStreamIdsFor(this.localScreenTrackIds());
  }

  private localScreenAudioStreamIds(): string[] {
    return this.localMediaStreamIdsFor(this.localScreenAudioTrackIds());
  }

  private localMediaStreamIdsFor(trackIds: string[]): string[] {
    const activeTrackIds = new Set(trackIds);
    const streamIds: string[] = [];

    for (const [trackId, stream] of this.localScreenStreams.entries()) {
      if (!activeTrackIds.has(trackId)) continue;

      streamIds.push(stream.id);
    }

    return streamIds;
  }

  private rememberRemoteScreenShareMetadata(
    peerIdentityId: string,
    payload: DescriptionSignalPayload,
  ): void {
    this.rememberRemoteScreenVideoMetadata(peerIdentityId, payload);
    this.rememberRemoteScreenAudioMetadata(peerIdentityId, payload);
  }

  private rememberRemoteScreenVideoMetadata(
    peerIdentityId: string,
    payload: DescriptionSignalPayload,
  ): void {
    this.remoteScreenTrackIds.set(
      peerIdentityId,
      new Set(payload.screenTrackIds ?? []),
    );
    this.remoteScreenStreamIds.set(
      peerIdentityId,
      new Set(payload.screenStreamIds ?? []),
    );

    if (!payload.screenTrackIds?.length && !payload.screenStreamIds?.length) {
      this.remoteScreenStreams.delete(peerIdentityId);
    }
  }

  private rememberRemoteScreenAudioMetadata(
    peerIdentityId: string,
    payload: DescriptionSignalPayload,
  ): void {
    this.remoteScreenAudioTrackIds.set(
      peerIdentityId,
      new Set(payload.screenAudioTrackIds ?? []),
    );
    this.remoteScreenAudioStreamIds.set(
      peerIdentityId,
      new Set(payload.screenAudioStreamIds ?? []),
    );

    if (
      !payload.screenAudioTrackIds?.length &&
      !payload.screenAudioStreamIds?.length
    ) {
      this.removeRemoteAudioChannel(remoteAudioKey(peerIdentityId, 'screen'));
    }
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

    if (this.handleRemoteScreenVideoTrack(peerIdentityId, event)) return;

    if (this.handleRemoteScreenAudioTrack(peerIdentityId, event)) return;

    this.remoteStreams.set(peerIdentityId, stream);

    if (event.track.kind === 'audio') {
      this.playRemoteAudioTrack(peerIdentityId, event.track);
    } else if (hasAudioTrack(event.track, stream)) {
      this.playRemoteStream(peerIdentityId, stream);
    }
  }

  private handleRemoteScreenVideoTrack(
    peerIdentityId: string,
    event: RTCTrackEvent,
  ): boolean {
    if (
      !isRemoteScreenShareTrack(
        event.track,
        event.streams,
        this.remoteScreenTrackIds.get(peerIdentityId) ?? new Set(),
        this.remoteScreenStreamIds.get(peerIdentityId) ?? new Set(),
      )
    ) {
      return false;
    }

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

    return true;
  }

  private handleRemoteScreenAudioTrack(
    peerIdentityId: string,
    event: RTCTrackEvent,
  ): boolean {
    if (
      !isRemoteScreenShareAudioTrack(
        event.track,
        event.streams,
        this.remoteScreenAudioTrackIds.get(peerIdentityId) ?? new Set(),
        this.remoteScreenAudioStreamIds.get(peerIdentityId) ?? new Set(),
      )
    ) {
      return false;
    }

    this.playRemoteScreenAudioTrack(peerIdentityId, event.track);

    return true;
  }

  private playRemoteAudioTrack(
    peerIdentityId: string,
    track: MediaStreamTrack,
  ): void {
    const stream =
      this.remoteAudioStreams.get(peerIdentityId) ?? new MediaStream();

    if (
      !stream.getAudioTracks().some((audioTrack) => audioTrack.id === track.id)
    ) {
      stream.addTrack(track);
    }

    this.remoteAudioStreams.set(peerIdentityId, stream);
    track.addEventListener('ended', () => {
      stream.removeTrack(track);

      if (stream.getAudioTracks().length > 0) {
        this.playRemoteStream(peerIdentityId, stream);

        return;
      }

      this.remoteAudioStreams.delete(peerIdentityId);
      this.resetRemoteAudioOutput(peerIdentityId);
      this.removeRemoteAudio(peerIdentityId);
    });
    this.playRemoteStream(peerIdentityId, stream);
  }

  private playRemoteScreenAudioTrack(
    peerIdentityId: string,
    track: MediaStreamTrack,
  ): void {
    this.playRemoteAudioTrack(remoteAudioKey(peerIdentityId, 'screen'), track);
  }

  private syncLocalTracks(): void {
    const activeTracks = this.localStream?.getTracks() ?? [];

    for (const peer of this.peers.values()) {
      this.syncPeerLocalTracks(peer, activeTracks);
    }
  }

  private syncPeerLocalTracks(
    peer: RTCPeerConnection,
    activeTracks: MediaStreamTrack[],
  ): void {
    const activeTrackSet = new Set(activeTracks);
    const syncedTracks = new Set<MediaStreamTrack>();

    for (const sender of peer.getSenders()) {
      this.syncLocalSender(
        peer,
        sender,
        activeTracks,
        activeTrackSet,
        syncedTracks,
      );
    }

    for (const track of activeTracks) {
      this.addMissingLocalTrack(peer, track, syncedTracks);
    }
  }

  private syncLocalSender(
    peer: RTCPeerConnection,
    sender: RTCRtpSender,
    activeTracks: MediaStreamTrack[],
    activeTrackSet: Set<MediaStreamTrack>,
    syncedTracks: Set<MediaStreamTrack>,
  ): void {
    const track = sender.track;

    if (!track) return;

    if (activeTrackSet.has(track)) {
      syncedTracks.add(track);

      return;
    }

    const replacement = replacementLocalTrack(track, activeTracks);

    if (!replacement || syncedTracks.has(replacement)) {
      peer.removeTrack(sender);

      return;
    }

    syncedTracks.add(replacement);
    void sender
      .replaceTrack(replacement)
      .then(() => this.configureLocalSender(sender))
      .catch((error: unknown) => {
        logCallError('peer-manager:replace-local-track-failed', error, {
          kind: replacement.kind,
        });
      });
  }

  private addMissingLocalTrack(
    peer: RTCPeerConnection,
    track: MediaStreamTrack,
    syncedTracks: Set<MediaStreamTrack>,
  ): void {
    if (!this.localStream || this.hasLocalSender(peer, track, syncedTracks)) {
      return;
    }

    this.configureLocalSender(
      peer.addTrack(track, this.localTrackStream(track)),
    );
  }

  private configureLocalSender(sender: RTCRtpSender): void {
    if (!sender.track || !isScreenShareTrack(sender.track)) return;

    if (
      typeof sender.getParameters !== 'function' ||
      typeof sender.setParameters !== 'function'
    ) {
      return;
    }

    const encoding = screenShareEncodingParameters(this.screenShareQuality);
    const parameters = sender.getParameters();
    const [currentEncoding = {}] = parameters.encodings ?? [{}];
    const nextEncoding = { ...currentEncoding, ...encoding };

    if (encoding.maxBitrate === undefined) delete nextEncoding.maxBitrate;

    if (encoding.maxFramerate === undefined) delete nextEncoding.maxFramerate;

    parameters.encodings = [nextEncoding];
    void sender.setParameters(parameters).catch((error: unknown) => {
      logCallWarning('peer-manager:screen-quality:sender-params-failed', {
        error,
      });
    });
  }

  private syncScreenShareEncodingParameters(): void {
    for (const peer of this.peers.values()) {
      peer.getSenders().forEach((sender) => this.configureLocalSender(sender));
    }
  }

  private hasLocalSender(
    peer: RTCPeerConnection,
    track: MediaStreamTrack,
    syncedTracks: Set<MediaStreamTrack>,
  ): boolean {
    return (
      syncedTracks.has(track) ||
      peer
        .getSenders()
        .some(
          (sender) => sender.track?.id === track.id || sender.track === track,
        )
    );
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
        descriptionPayload(
          offer,
          this.localScreenAudioTrackIds(),
          this.localScreenAudioStreamIds(),
          this.localScreenTrackIds(),
          this.localScreenStreamIds(),
        ),
      );
    } finally {
      state.makingOffer = false;
    }
  }

  private playRemoteStream(peerIdentityId: string, stream: MediaStream): void {
    const audio =
      this.remoteAudio.get(peerIdentityId) ?? document.createElement('audio');
    const volume = this.remoteAudioVolumes.get(peerIdentityId) ?? 1;

    audio.autoplay = true;
    audio.muted = this.deafened;
    audio.srcObject = stream;

    if (!this.remoteAudio.has(peerIdentityId)) {
      audio.dataset.peerIdentityId = peerIdentityId;
      audio.className = 'hidden';
      document.body.append(audio);
      this.remoteAudio.set(peerIdentityId, audio);
    }

    this.syncRemoteAudioOutput(peerIdentityId, stream, volume);
    audio.volume = this.remoteAudioGains.has(peerIdentityId)
      ? 0
      : nativeAudioVolume(volume);
    logCallDebug('peer-manager:remote-audio:play-requested', {
      deafened: this.deafened,
      peerIdentityId,
      trackCount: stream.getTracks().length,
    });

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

  private syncRemoteAudioOutput(
    peerIdentityId: string,
    stream: MediaStream,
    volume: number,
  ): void {
    if (this.remoteAudioOutputStreams.get(peerIdentityId) !== stream) {
      this.resetRemoteAudioOutput(peerIdentityId);
    }

    if (this.remoteAudioGains.has(peerIdentityId)) {
      this.applyRemoteAudioOutputVolume(peerIdentityId, volume);

      return;
    }

    if (!needsAudioGraph(volume)) return;

    this.createRemoteAudioOutput(peerIdentityId, stream, volume);
  }

  private createRemoteAudioOutput(
    peerIdentityId: string,
    stream: MediaStream,
    volume: number,
  ): void {
    const AudioContextConstructor =
      typeof window === 'undefined'
        ? undefined
        : (window.AudioContext ??
          (window as BrowserWindowWithWebkitAudioContext).webkitAudioContext);

    if (!AudioContextConstructor) {
      return;
    }

    try {
      const audioContext = new AudioContextConstructor();
      const source = audioContext.createMediaStreamSource(stream);
      const gain = audioContext.createGain();

      gain.gain.value = graphAudioVolume(volume, this.deafened);
      source.connect(gain).connect(audioContext.destination);
      this.remoteAudioContexts.set(peerIdentityId, audioContext);
      this.remoteAudioGains.set(peerIdentityId, gain);
      this.remoteAudioOutputSources.set(peerIdentityId, source);
      this.remoteAudioOutputStreams.set(peerIdentityId, stream);
      void audioContext.resume().catch(() => undefined);
    } catch (error) {
      logCallError('peer-manager:remote-audio:gain-setup-failed', error, {
        peerIdentityId,
      });
    }
  }

  private applyRemoteAudioOutputVolume(
    peerIdentityId: string,
    volume: number,
  ): void {
    const gain = this.remoteAudioGains.get(peerIdentityId);

    if (!gain) return;

    gain.gain.setValueAtTime(
      graphAudioVolume(volume, this.deafened),
      this.remoteAudioContexts.get(peerIdentityId)?.currentTime ?? 0,
    );
    void this.remoteAudioContexts
      .get(peerIdentityId)
      ?.resume()
      .catch(() => undefined);
  }

  private resetRemoteAudioOutput(peerIdentityId: string): void {
    this.remoteAudioOutputSources.get(peerIdentityId)?.disconnect();
    void this.remoteAudioContexts
      .get(peerIdentityId)
      ?.close()
      .catch(() => undefined);
    this.remoteAudioOutputSources.delete(peerIdentityId);
    this.remoteAudioGains.delete(peerIdentityId);
    this.remoteAudioContexts.delete(peerIdentityId);
    this.remoteAudioOutputStreams.delete(peerIdentityId);
  }

  private removePeer(peerIdentityId: string): void {
    this.peers.get(peerIdentityId)?.close();
    this.peers.delete(peerIdentityId);
    this.pendingIceCandidates.delete(peerIdentityId);
    this.peerNegotiationStates.delete(peerIdentityId);
    this.remoteStreams.delete(peerIdentityId);
    this.remoteScreenStreams.delete(peerIdentityId);
    this.remoteScreenStreamIds.delete(peerIdentityId);
    this.remoteScreenTrackIds.delete(peerIdentityId);
    this.remoteScreenAudioStreamIds.delete(peerIdentityId);
    this.remoteScreenAudioTrackIds.delete(peerIdentityId);
    this.removeRemoteAudioChannel(remoteAudioKey(peerIdentityId, 'voice'));
    this.removeRemoteAudioChannel(remoteAudioKey(peerIdentityId, 'screen'));
  }

  private removeRemoteAudioChannel(audioKey: string): void {
    this.remoteAudioStreams.delete(audioKey);
    this.resetRemoteAudioOutput(audioKey);
    this.removeRemoteAudio(audioKey);
    this.remoteAudioVolumes.delete(audioKey);
  }

  private removeRemoteAudio(peerIdentityId: string): void {
    const audio = this.remoteAudio.get(peerIdentityId);

    if (!audio) return;

    audio.pause();
    audio.srcObject = null;
    audio.remove();
    this.remoteAudio.delete(peerIdentityId);
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

  public retainPeers(peerIdentityIds: Set<string>): void {
    for (const peerIdentityId of this.peers.keys()) {
      if (!peerIdentityIds.has(peerIdentityId)) {
        this.removePeer(peerIdentityId);
      }
    }
  }

  public setDeafened(deafened: boolean): void {
    this.deafened = deafened;
    logCallDebug('peer-manager:set-deafened', {
      deafened,
      remoteAudioCount: this.remoteAudio.size,
    });

    for (const [audioKey, audio] of this.remoteAudio.entries()) {
      const hasAudioGraph = this.remoteAudioGains.has(audioKey);

      audio.muted = deafened;
      this.applyRemoteAudioOutputVolume(
        audioKey,
        this.remoteAudioVolumes.get(audioKey) ?? 1,
      );

      if (hasAudioGraph) continue;

      if (deafened) {
        audio.pause();
      } else {
        void audio.play().catch(() => undefined);
      }
    }
  }

  public setPeerVolume(peerIdentityId: string, volumePercent: number): void {
    this.setRemoteAudioChannelVolume(
      remoteAudioKey(peerIdentityId, 'voice'),
      volumePercent,
    );

    logCallDebug('peer-manager:set-peer-volume', {
      peerIdentityId,
      volumePercent,
    });
  }

  public setPeerScreenShareVolume(
    peerIdentityId: string,
    volumePercent: number,
  ): void {
    this.setRemoteAudioChannelVolume(
      remoteAudioKey(peerIdentityId, 'screen'),
      volumePercent,
    );

    logCallDebug('peer-manager:set-peer-screen-share-volume', {
      peerIdentityId,
      volumePercent,
    });
  }

  public setScreenShareQuality(quality: ScreenShareQualityPreset): void {
    this.screenShareQuality = quality;
    this.syncScreenShareEncodingParameters();
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
        descriptionPayload(
          offer,
          this.localScreenAudioTrackIds(),
          this.localScreenAudioStreamIds(),
          this.localScreenTrackIds(),
          this.localScreenStreamIds(),
        ),
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
    for (const source of this.remoteAudioOutputSources.values()) {
      source.disconnect();
    }
    for (const audioContext of this.remoteAudioContexts.values()) {
      void audioContext.close().catch(() => undefined);
    }
    this.remoteAudio.clear();
    this.remoteAudioContexts.clear();
    this.remoteAudioGains.clear();
    this.remoteAudioOutputSources.clear();
    this.remoteAudioOutputStreams.clear();
    this.remoteAudioStreams.clear();
    this.remoteAudioVolumes.clear();
    this.remoteStreams.clear();
    this.remoteScreenStreams.clear();
    this.remoteScreenStreamIds.clear();
    this.remoteScreenTrackIds.clear();
    this.remoteScreenAudioStreamIds.clear();
    this.remoteScreenAudioTrackIds.clear();
    this.localScreenStreams.clear();
    this.previousStatsSamples.clear();
    this.localStream = null;
    this.rtcConfiguration = null;
    this.deafened = false;
  }

  public async collectStats(): Promise<Record<string, PeerMediaStats>> {
    const entries = await Promise.all(
      [...this.peers.entries()].map(
        async ([identityId, peer]): Promise<[string, PeerMediaStats]> => {
          const firstPassStats = await collectPeerMediaStats(peer);
          const bitrateKbps = this.bitrateFor(identityId, firstPassStats);

          return [
            identityId,
            bitrateKbps === undefined
              ? firstPassStats
              : { ...firstPassStats, bitrateKbps },
          ];
        },
      ),
    );
    const stats: Record<string, PeerMediaStats> = {};

    for (const [identityId, peerStats] of entries) {
      stats[identityId] = peerStats;
    }

    return stats;
  }
}
