import type { CallMediaFramePeer } from '@haskou/pigeon-swarm-crypto';

import type { CallMediaKey } from './CallMediaKey';
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
import { CallPeerRestartError } from './CallPeerRestartError';
import { CallPeerStatistics } from './CallPeerStatistics';
import { CallScreenShareStreams } from './CallScreenShareStreams';
import { CallSignalRetry } from './CallSignalRetry';
import {
  type DescriptionSignalPayload,
  type SignalSender,
} from './descriptionPayload';
import { RemoteCallAudio } from './RemoteCallAudio';

export type { PeerMediaStats } from './collectPeerMediaStats';

/**
 * How long an answered offer holds its peer through snapshots that omit its
 * participant. The offer proves the join, but a snapshot taken before the join
 * can still omit it. The first snapshot that shows the participant ends the
 * hold. A leave that no snapshot showed joined is released when this ends.
 */
const answeredPeerRetentionMs = 10_000;

export class CallPeerConnections {
  private readonly iceCandidates: CallIceCandidates;
  private readonly localTracks: CallLocalTracks;
  private readonly mediaEncryption = new CallMediaEncryption();
  private readonly negotiation: CallPeerNegotiation;
  private readonly peers = new Map<string, RTCPeerConnection>();
  private readonly statistics = new CallPeerStatistics();
  private readonly recovery = new CallPeerRecovery(
    (peerIdentityId, peer, canRestart) =>
      this.refreshAndRestartIce(peerIdentityId, peer, canRestart),
    (peerIdentityId, canRestart) =>
      this.replaceStalledPeer(peerIdentityId, canRestart),
  );

  private readonly peerSignalSenders = new Map<string, SignalSender>();
  private readonly pendingPeerCreations = new Map<
    string,
    Promise<RTCPeerConnection | undefined>
  >();

  private readonly remoteStreams = new Map<string, MediaStream>();
  private readonly screenShareStreams: CallScreenShareStreams;
  private rtcConfigurationProvider: RtcConfigurationProvider | null = null;
  private readonly answeredAt = new Map<string, number>();
  /**
   * Peers whose answer hold ended or that a snapshot released. Their offers are
   * refused until a snapshot lists them joined again.
   */
  private readonly spentAnswerHolds = new Set<string>();
  /**
   * Counts the resets. A connection whose creation began before a reset is
   * never built, since the call it served has ended.
   */
  private resets = 0;
  private lastRetainedPeerIdentityIds = new Set<string>();
  private stopAnswerRelease: (() => void) | undefined;

  /** Browsers with WebRTC turned off, such as Tor Browser, expose no peers. */
  public static supported(): boolean {
    return typeof RTCPeerConnection !== 'undefined';
  }

  public static mediaEncryptionSupported(): boolean {
    return CallMediaEncryption.supported();
  }

  public constructor(private readonly remoteAudio: RemoteCallAudio) {
    const peerFor = (peerIdentityId: string) => this.peers.get(peerIdentityId);
    const signalRetry = new CallSignalRetry();

    this.screenShareStreams = new CallScreenShareStreams(remoteAudio);
    this.localTracks = new CallLocalTracks(
      this.screenShareStreams,
      this.mediaEncryption,
    );
    this.iceCandidates = new CallIceCandidates(peerFor, signalRetry);
    this.negotiation = new CallPeerNegotiation(
      peerFor,
      (peerIdentityId, sendSignal) =>
        this.replacePeer(peerIdentityId, sendSignal),
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
  ): Promise<RTCPeerConnection | undefined> {
    if (!this.rtcConfigurationProvider) {
      logCallError(
        'peer-manager:create-peer:missing-rtc-configuration',
        new Error('RTCPeerConnection configuration is not loaded.'),
        { peerIdentityId },
      );
      throw new Error('RTCPeerConnection configuration is not loaded.');
    }

    const resets = this.resets;
    const configuration = await this.rtcConfigurationProvider();

    // A peer released, or a call reset, while its configuration loaded gets
    // no connection: nothing could release a connection not yet in peers.
    if (resets !== this.resets || this.spentAnswerHolds.has(peerIdentityId)) {
      logCallDebug('peer-manager:create-peer:abandoned', { peerIdentityId });

      return undefined;
    }

    const rtcConfiguration =
      this.mediaEncryption.peerConfiguration(configuration);
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
    // Chromium passes the frames of a sender or receiver that has no
    // transform once the task creating it ends, even if one comes later.
    this.mediaEncryption.syncPeer(peerIdentityId, peer);
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
      // A remote description has just created any transceiver it needs.
      this.mediaEncryption.syncPeer(peerIdentityId, peer);
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

      this.mediaEncryption.configureReceiver(
        peerIdentityId,
        event.receiver,
        this.screenShareStreams.remoteMediaTrack(peerIdentityId, event),
      );
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
    // Bound a peer that never starts negotiating, such as a callee whose
    // offer was lost before any state change would schedule recovery.
    this.recovery.reconcile(
      peerIdentityId,
      peer,
      () => this.peers.get(peerIdentityId) === peer,
    );

    return peer;
  }

  private async getOrCreatePeer(
    peerIdentityId: string,
    sendSignal: SignalSender,
  ): Promise<RTCPeerConnection | undefined> {
    const existing = this.peers.get(peerIdentityId);

    if (existing) return existing;

    const pendingPeerCreation = this.pendingPeerCreations.get(peerIdentityId);

    if (pendingPeerCreation) return await pendingPeerCreation;

    const peerCreation = this.createPeer(peerIdentityId, sendSignal);

    this.pendingPeerCreations.set(peerIdentityId, peerCreation);

    try {
      return await peerCreation;
    } finally {
      // A reset may have cleared the entry, and a newer creation may own it.
      if (this.pendingPeerCreations.get(peerIdentityId) === peerCreation) {
        this.pendingPeerCreations.delete(peerIdentityId);
      }
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

  /**
   * Repeats whichever step left the peer stuck: an offer the remote peer
   * never answered, an initial offer that never arrived, or ICE itself. Each
   * failure names its step for diagnostics.
   */
  private async refreshAndRestartIce(
    peerIdentityId: string,
    peer: RTCPeerConnection,
    canRestart: () => boolean,
  ): Promise<void> {
    const configuration = await this.rtcConfigurationProvider?.().catch(
      () => undefined,
    );

    if (!configuration) throw new CallPeerRestartError('configuration');

    if (!canRestart()) return;

    try {
      // Rotate server credentials without changing the established transport
      // policy or other immutable peer configuration.
      peer.setConfiguration({
        ...peer.getConfiguration(),
        iceServers: configuration.iceServers,
      });
    } catch {
      throw new CallPeerRestartError('ice-restart');
    }

    const resent = await this.sendRecoveryOffer(peerIdentityId, peer).catch(
      () => {
        throw new CallPeerRestartError('signal');
      },
    );

    if (resent || !canRestart()) return;

    try {
      peer.restartIce();
    } catch {
      throw new CallPeerRestartError('ice-restart');
    }
  }

  /**
   * A peer that never received an offer asks for negotiation with its own;
   * the designated offerer answers it, or re-sends its pending offer during
   * glare. An offer left unanswered is delivered once more.
   */
  private async sendRecoveryOffer(
    peerIdentityId: string,
    peer: RTCPeerConnection,
  ): Promise<boolean> {
    const sendSignal = this.peerSignalSenders.get(peerIdentityId);

    if (!sendSignal) return false;

    if (
      peer.iceConnectionState === 'new' &&
      !peer.localDescription &&
      !peer.remoteDescription
    ) {
      logCallWarning('peer-manager:ice-recovery:requested-offer');
      await this.negotiation.offerIfNeeded(
        peerIdentityId,
        peer,
        true,
        sendSignal,
      );

      return true;
    }

    return await this.negotiation.resendUnansweredOffer(
      peerIdentityId,
      peer,
      sendSignal,
    );
  }

  /**
   * Drops the connection and what hangs on it. What outlives it is what a
   * connection that replaces it needs: the remote peer's admission to a
   * private call, the ICE candidates it sent for the new connection, and its
   * answer hold, which belongs to the snapshot rather than the connection.
   */
  private closePeer(peerIdentityId: string): void {
    this.peers.get(peerIdentityId)?.close();
    this.peers.delete(peerIdentityId);
    this.remoteStreams.delete(peerIdentityId);
    this.screenShareStreams.forget(peerIdentityId);
    this.remoteAudio.removePeer(peerIdentityId);
  }

  private removePeer(peerIdentityId: string): void {
    this.recovery.forget(peerIdentityId);
    this.discardPeer(peerIdentityId);
  }

  private discardPeer(peerIdentityId: string): void {
    this.closePeer(peerIdentityId);
    this.iceCandidates.forget(peerIdentityId);
    this.mediaEncryption.forget(peerIdentityId);
    this.negotiation.forget(peerIdentityId);
    this.peerSignalSenders.delete(peerIdentityId);
  }

  /**
   * Starts the answer hold on the first answered offer of an omission. Later
   * offers never restart it, so a sender cannot keep an omitted peer connected
   * by signaling again.
   */
  private markAnsweredOffer(
    peerIdentityId: string,
    signalType: CallSignalType,
  ): void {
    if (signalType === 'offer' && !this.answeredAt.has(peerIdentityId)) {
      this.answeredAt.set(peerIdentityId, Date.now());
    }
  }

  /**
   * Whether a signal may create or keep a connection. A peer that a snapshot
   * released, or whose hold ended, is refused until a snapshot lists it again.
   * A peer that signals again after a refusal gets a new connection with every
   * signal, so the connections created for it count like replacements.
   */
  private admitsSignalFrom(senderIdentityId: string): boolean {
    if (this.spentAnswerHolds.has(senderIdentityId)) return false;

    return (
      this.peers.has(senderIdentityId) ||
      this.pendingPeerCreations.has(senderIdentityId) ||
      this.recovery.allowReplacement(senderIdentityId)
    );
  }

  /** Ends the holds whose window has passed. An ended hold never re-arms. */
  private endExpiredAnswerHolds(now: number): void {
    for (const [peerIdentityId, answeredAt] of this.answeredAt) {
      if (now - answeredAt < answeredPeerRetentionMs) continue;

      this.answeredAt.delete(peerIdentityId);
      this.spentAnswerHolds.add(peerIdentityId);
    }
  }

  /**
   * Re-runs the retention when the earliest open hold leaves its window, since
   * no later snapshot is guaranteed to arrive.
   */
  private scheduleAnswerRelease(): void {
    this.cancelAnswerRelease();
    let nextRelease: number | undefined;

    for (const answeredAt of this.answeredAt.values()) {
      const release = answeredAt + answeredPeerRetentionMs;

      nextRelease = Math.min(nextRelease ?? release, release);
    }

    if (nextRelease === undefined) return;

    const timeout = setTimeout(() => {
      this.stopAnswerRelease = undefined;
      this.retainPeers(this.lastRetainedPeerIdentityIds, new Set());
    }, nextRelease - Date.now());
    this.stopAnswerRelease = () => clearTimeout(timeout);
  }

  private cancelAnswerRelease(): void {
    this.stopAnswerRelease?.();
    this.stopAnswerRelease = undefined;
  }

  private async replacePeer(
    peerIdentityId: string,
    sendSignal: SignalSender,
  ): Promise<RTCPeerConnection | undefined> {
    if (!this.recovery.allowReplacement(peerIdentityId)) return undefined;

    this.recovery.detach(peerIdentityId);
    this.closePeer(peerIdentityId);

    return await this.getOrCreatePeer(peerIdentityId, sendSignal);
  }

  /**
   * Replaces a connection whose ICE connected while its DTLS never finished.
   * Then offers on the new connection, which the remote peer answers.
   */
  private async replaceStalledPeer(
    peerIdentityId: string,
    canRestart: () => boolean,
  ): Promise<void> {
    const sendSignal = this.peerSignalSenders.get(peerIdentityId);

    if (!sendSignal || !canRestart()) return;

    const replacement = await this.replacePeer(peerIdentityId, sendSignal);

    if (replacement)
      await this.negotiation.offerIfNeeded(
        peerIdentityId,
        replacement,
        true,
        sendSignal,
      );
  }

  public configure(rtcConfigurationProvider: RtcConfigurationProvider): void {
    this.rtcConfigurationProvider = rtcConfigurationProvider;
    logCallDebug('peer-manager:configure');
  }

  /**
   * A private call has the `key` this identity seals `call`'s media with; a
   * public one has none.
   */
  public configureMediaEncryption(
    call: CallMediaFramePeer,
    key: CallMediaKey | null,
  ): void {
    this.mediaEncryption.configure(call, key);
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

    if (!peer) return;

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

    if (
      signalType !== 'ice_candidate' &&
      !this.mediaEncryption.admits(
        payload as unknown as DescriptionSignalPayload,
      )
    ) {
      logCallWarning('peer-manager:media-encryption:refused-peer', {
        senderIdentityId,
        signalType,
      });
      this.recovery.abandon(senderIdentityId);
      this.discardPeer(senderIdentityId);

      return;
    }

    if (!this.admitsSignalFrom(senderIdentityId)) return;

    this.peerSignalSenders.set(senderIdentityId, sendSignal);
    const peer = await this.getOrCreatePeer(senderIdentityId, sendSignal);

    if (!peer) return;

    if (signalType === 'ice_candidate') {
      await this.iceCandidates.handleSignal(
        senderIdentityId,
        peer,
        payload as RTCIceCandidateInit,
        this.negotiation.state(senderIdentityId),
      );

      return;
    }

    this.markAnsweredOffer(senderIdentityId, signalType);

    await this.negotiation.handleDescriptionSignal(
      senderIdentityId,
      payload as unknown as DescriptionSignalPayload,
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

  /** Moves a private call's media to the `key` of a newer epoch. */
  public rekeyMediaEncryption(key: CallMediaKey): void {
    this.mediaEncryption.rekey(key);
  }

  public reset(): void {
    logCallDebug('peer-manager:reset', {
      peerCount: this.peers.size,
    });
    this.peers.forEach((peer) => peer.close());
    this.peers.clear();
    this.mediaEncryption.reset();
    this.pendingPeerCreations.clear();
    this.resets += 1;
    this.recovery.reset();
    this.iceCandidates.reset();
    this.negotiation.reset();
    this.peerSignalSenders.clear();
    this.cancelAnswerRelease();
    this.answeredAt.clear();
    this.spentAnswerHolds.clear();
    this.lastRetainedPeerIdentityIds = new Set();

    this.remoteAudio.reset();
    this.remoteStreams.clear();
    this.screenShareStreams.reset();
    this.statistics.reset();
    this.localTracks.reset();
    this.rtcConfigurationProvider = null;
  }

  /**
   * Applies a snapshot. Listed peers stay. Released peers go at once and stay
   * refused until a snapshot lists them joined again. An answered peer that the
   * snapshot omits stays for one window from its first answered offer.
   */
  public retainPeers(
    peerIdentityIds: Set<string>,
    releasedPeerIdentityIds: Set<string>,
  ): void {
    const now = Date.now();
    const listed = new Set(peerIdentityIds);

    for (const peerIdentityId of releasedPeerIdentityIds) {
      listed.delete(peerIdentityId);
      this.answeredAt.delete(peerIdentityId);
      this.spentAnswerHolds.add(peerIdentityId);
      this.peerSignalSenders.delete(peerIdentityId);
    }

    for (const peerIdentityId of listed) {
      this.answeredAt.delete(peerIdentityId);
      this.spentAnswerHolds.delete(peerIdentityId);
    }
    this.endExpiredAnswerHolds(now);
    this.lastRetainedPeerIdentityIds = listed;

    const retained = new Set(listed);

    for (const peerIdentityId of this.answeredAt.keys()) {
      retained.add(peerIdentityId);
    }

    for (const peerIdentityId of this.peers.keys()) {
      if (!retained.has(peerIdentityId)) {
        this.removePeer(peerIdentityId);
      }
    }
    this.recovery.retain(retained);
    this.scheduleAnswerRelease();
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

  public recoverAfterDisruption(): void {
    this.peers.forEach((peer, identityId) => {
      this.recovery.disrupt(
        identityId,
        peer,
        this.negotiation.state(identityId).polite,
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
