import type { CallSignalType } from './CallSignalType';
import type { PeerMediaStats } from './collectPeerMediaStats';
import type { RtcConfigurationProvider } from './RtcConfigurationProvider';
import type { ScreenShareQualityPreset } from './ScreenShareQualityPreset';

import { logCallDebug, logCallError, logCallWarning } from './callDebugLogger';
import { CallIceCandidates } from './CallIceCandidates';
import { CallLocalTracks } from './CallLocalTracks';
import { CallMediaEncryption } from './CallMediaEncryption';
import { hasAudioTrack } from './callMediaTrackClassification';
import { CallPeerNegotiation } from './CallPeerNegotiation';
import { CallPeerRecovery } from './CallPeerRecovery';
import { CallPeerStatistics } from './CallPeerStatistics';
import { CallScreenShareStreams } from './CallScreenShareStreams';
import { CallSignalRetry } from './CallSignalRetry';
import {
  type DescriptionSignalPayload,
  type SignalSender,
} from './descriptionPayload';
import { RemoteCallAudio } from './RemoteCallAudio';

export type { PeerMediaStats } from './collectPeerMediaStats';

export class CallPeerConnections {
  private readonly iceCandidates: CallIceCandidates;
  private readonly localTracks: CallLocalTracks;
  private readonly mediaEncryption = new CallMediaEncryption();
  private readonly negotiation: CallPeerNegotiation;
  private readonly peers = new Map<string, RTCPeerConnection>();
  private readonly statistics = new CallPeerStatistics();
  private readonly recovery = new CallPeerRecovery((peer, canRestart) =>
    this.refreshAndRestartIce(peer, canRestart),
  );

  private readonly peerSignalSenders = new Map<string, SignalSender>();
  private readonly pendingPeerCreations = new Map<
    string,
    Promise<RTCPeerConnection>
  >();

  private readonly remoteStreams = new Map<string, MediaStream>();
  private readonly screenShareStreams: CallScreenShareStreams;
  private rtcConfigurationProvider: RtcConfigurationProvider | null = null;

  public static mediaEncryptionSupported(): boolean {
    return CallMediaEncryption.supported();
  }

  public constructor(private readonly remoteAudio: RemoteCallAudio) {
    const peerFor = (peerIdentityId: string) => this.peers.get(peerIdentityId);
    const signalRetry = new CallSignalRetry();

    this.screenShareStreams = new CallScreenShareStreams(remoteAudio);
    this.localTracks = new CallLocalTracks(
      peerFor,
      this.screenShareStreams,
      this.mediaEncryption,
    );
    this.iceCandidates = new CallIceCandidates(peerFor, signalRetry);
    this.negotiation = new CallPeerNegotiation(
      peerFor,
      signalRetry,
      this.screenShareStreams,
      this.localTracks,
      this.mediaEncryption,
      this.iceCandidates,
    );
  }

  private async createPeer(
    peerIdentityId: string,
    sendSignal: SignalSender,
  ): Promise<RTCPeerConnection> {
    if (!this.rtcConfigurationProvider) {
      logCallError(
        'peer-manager:create-peer:missing-rtc-configuration',
        new Error('RTCPeerConnection configuration is not loaded.'),
        { peerIdentityId },
      );
      throw new Error('RTCPeerConnection configuration is not loaded.');
    }

    const rtcConfiguration = this.mediaEncryption.peerConfiguration(
      await this.rtcConfigurationProvider(),
    );
    const peer = new RTCPeerConnection(rtcConfiguration);

    this.peerSignalSenders.set(peerIdentityId, sendSignal);
    logCallDebug('peer-manager:create-peer', {
      hasLocalStream: Boolean(this.localTracks.stream),
      iceServerCount: rtcConfiguration.iceServers?.length ?? 0,
      peerIdentityId,
    });

    if (this.localTracks.stream) {
      this.localTracks.addToPeer(peer, peerIdentityId);
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
      this.recovery.reconcile(
        peerIdentityId,
        peer,
        () => this.peers.get(peerIdentityId) === peer,
      );
    });
    peer.addEventListener('iceconnectionstatechange', () => {
      logCallDebug('peer-manager:ice-connection-state-change', {
        iceConnectionState: peer.iceConnectionState,
        peerIdentityId,
      });
      this.recovery.reconcile(
        peerIdentityId,
        peer,
        () => this.peers.get(peerIdentityId) === peer,
      );
    });
    peer.addEventListener('signalingstatechange', () => {
      logCallDebug('peer-manager:signaling-state-change', {
        peerIdentityId,
        signalingState: peer.signalingState,
      });
      this.recovery.reconcile(
        peerIdentityId,
        peer,
        () => this.peers.get(peerIdentityId) === peer,
      );
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
      void this.iceCandidates
        .send(peerIdentityId, peer, event.candidate.toJSON(), sendSignal)
        .catch(() => {
          logCallDebug('peer-manager:ice-candidate:send-failed', {
            peerIdentityId,
          });
        });
    });
    peer.addEventListener('negotiationneeded', () => {
      void this.negotiation.sendRenegotiationOffer(
        peerIdentityId,
        peer,
        sendSignal,
      );
    });
    peer.addEventListener('track', (event) => {
      const [stream] = event.streams;

      this.mediaEncryption.configureReceiver(event.receiver);
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

  private async getOrCreatePeer(
    peerIdentityId: string,
    sendSignal: SignalSender,
  ): Promise<RTCPeerConnection> {
    const existing = this.peers.get(peerIdentityId);

    if (existing) return existing;

    const pendingPeerCreation = this.pendingPeerCreations.get(peerIdentityId);

    if (pendingPeerCreation) return await pendingPeerCreation;

    const peerCreation = this.createPeer(peerIdentityId, sendSignal);

    this.pendingPeerCreations.set(peerIdentityId, peerCreation);

    try {
      return await peerCreation;
    } finally {
      this.pendingPeerCreations.delete(peerIdentityId);
    }
  }

  private handleRemoteTrack(
    peerIdentityId: string,
    event: RTCTrackEvent,
  ): void {
    const [receivedStream] = event.streams;
    const stream = receivedStream ?? new MediaStream([event.track]);

    if (this.screenShareStreams.handleRemoteTrack(peerIdentityId, event)) {
      return;
    }

    this.remoteStreams.set(peerIdentityId, stream);

    if (event.track.kind === 'audio') {
      this.remoteAudio.playVoiceTrack(peerIdentityId, event.track);
    } else if (hasAudioTrack(event.track, stream)) {
      this.remoteAudio.playVoiceStream(peerIdentityId, stream);
    }
  }

  private async refreshAndRestartIce(
    peer: RTCPeerConnection,
    canRestart: () => boolean,
  ): Promise<void> {
    if (!this.rtcConfigurationProvider) {
      throw new Error('RTC configuration provider is unavailable.');
    }

    const configuration = await this.rtcConfigurationProvider();

    if (!canRestart()) return;

    // Rotate server credentials without changing the established transport
    // policy or other immutable peer configuration.
    peer.setConfiguration({
      ...peer.getConfiguration(),
      iceServers: configuration.iceServers,
    });
    peer.restartIce();
  }

  private removePeer(peerIdentityId: string): void {
    this.recovery.forget(peerIdentityId);
    this.peers.get(peerIdentityId)?.close();
    this.peers.delete(peerIdentityId);
    this.iceCandidates.forget(peerIdentityId);
    this.mediaEncryption.forget(peerIdentityId);
    this.negotiation.forget(peerIdentityId);
    this.peerSignalSenders.delete(peerIdentityId);
    this.remoteStreams.delete(peerIdentityId);
    this.screenShareStreams.forget(peerIdentityId);
    this.remoteAudio.removePeer(peerIdentityId);
  }

  private async renegotiateMediaEncryption(): Promise<void> {
    await Promise.all(
      [...this.peers.entries()].map(async ([peerIdentityId, peer]) => {
        const sendSignal = this.peerSignalSenders.get(peerIdentityId);

        if (!sendSignal) return;

        await this.negotiation.sendRenegotiationOffer(
          peerIdentityId,
          peer,
          sendSignal,
        );
      }),
    );
  }

  public configure(rtcConfigurationProvider: RtcConfigurationProvider): void {
    this.rtcConfigurationProvider = rtcConfigurationProvider;
    logCallDebug('peer-manager:configure');
  }

  public configureMediaEncryption(
    base64Key: null | string,
    enabled: boolean,
  ): void {
    this.mediaEncryption.configure(base64Key, enabled);
    this.mediaEncryption.syncPeers(this.peers);
  }

  public async collectStats(): Promise<Record<string, PeerMediaStats>> {
    const stats = await this.statistics.collect(this.peers);

    return Object.fromEntries(
      Object.entries(stats).map(([identityId, stat]) => [
        identityId,
        {
          ...stat,
          recoveryState: this.recovery.stateFor(identityId),
        },
      ]),
    );
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
    this.negotiation.configureState(peerIdentityId, !shouldOffer);
    const peer = await this.getOrCreatePeer(peerIdentityId, sendSignal);

    await this.negotiation.offerIfNeeded(
      peerIdentityId,
      peer,
      shouldOffer,
      sendSignal,
    );
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
      this.negotiation.configureState(
        senderIdentityId,
        currentIdentityId > senderIdentityId,
      );
    }
    this.peerSignalSenders.set(senderIdentityId, sendSignal);
    const peer = await this.getOrCreatePeer(senderIdentityId, sendSignal);
    const state = this.negotiation.state(senderIdentityId);

    if (signalType === 'ice_candidate') {
      await this.iceCandidates.handleSignal(
        senderIdentityId,
        peer,
        payload as RTCIceCandidateInit,
        state,
      );

      return;
    }

    await this.negotiation.handleDescriptionSignal(
      senderIdentityId,
      peer,
      payload as unknown as DescriptionSignalPayload,
      state,
      sendSignal,
    );
  }

  public isMediaEncryptionActiveWith(peerIdentityId: string): boolean {
    return this.mediaEncryption.isActiveWith(peerIdentityId);
  }

  public mediaConnections(): ReturnType<CallPeerStatistics['connections']> {
    return this.statistics.connections();
  }

  public remoteMediaStreams(): Record<string, MediaStream> {
    return Object.fromEntries(this.remoteStreams.entries());
  }

  public remoteScreenMediaStreams(): Record<string, MediaStream> {
    return this.screenShareStreams.streams();
  }

  public reset(): void {
    logCallDebug('peer-manager:reset', {
      peerCount: this.peers.size,
    });
    this.peers.forEach((peer) => peer.close());
    this.peers.clear();
    this.mediaEncryption.reset();
    this.pendingPeerCreations.clear();
    this.recovery.reset();
    this.iceCandidates.reset();
    this.negotiation.reset();
    this.peerSignalSenders.clear();

    this.remoteAudio.reset();
    this.remoteStreams.clear();
    this.screenShareStreams.reset();
    this.statistics.reset();
    this.localTracks.reset();
    this.rtcConfigurationProvider = null;
  }

  public retainPeers(peerIdentityIds: Set<string>): void {
    for (const peerIdentityId of this.peers.keys()) {
      if (!peerIdentityIds.has(peerIdentityId)) {
        this.removePeer(peerIdentityId);
      }
    }
  }

  public retryConnections(): void {
    this.peers.forEach((peer, identityId) => {
      this.recovery.retry(
        identityId,
        peer,
        () => this.peers.get(identityId) === peer,
      );
    });
  }

  public setDeafened(deafened: boolean): void {
    this.remoteAudio.setDeafened(deafened);
  }

  public setLocalStream(stream: MediaStream | null): void {
    this.localTracks.setStream(stream, this.peers);
  }

  public setMediaEncryptionEnabled(enabled: boolean): void {
    this.mediaEncryption.setEnabled(enabled);
    void this.renegotiateMediaEncryption().catch((error: unknown) => {
      logCallWarning('peer-manager:media-encryption:renegotiate-failed', {
        error,
      });
    });
  }

  public setPeerScreenShareVolume(
    peerIdentityId: string,
    volumePercent: number,
  ): void {
    this.remoteAudio.setScreenVolume(peerIdentityId, volumePercent);

    logCallDebug('peer-manager:set-peer-screen-share-volume', {
      peerIdentityId,
      volumePercent,
    });
  }

  public setPeerVolume(peerIdentityId: string, volumePercent: number): void {
    this.remoteAudio.setVoiceVolume(peerIdentityId, volumePercent);

    logCallDebug('peer-manager:set-peer-volume', {
      peerIdentityId,
      volumePercent,
    });
  }

  public setScreenShareQuality(quality: ScreenShareQualityPreset): void {
    this.localTracks.setScreenShareQuality(quality, this.peers);
  }
}
