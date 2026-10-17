import type { CallIceCandidates } from './CallIceCandidates';
import type { CallLocalTracks } from './CallLocalTracks';
import type { CallMediaEncryption } from './CallMediaEncryption';
import type { CallScreenShareStreams } from './CallScreenShareStreams';
import type { CallSignalRetry } from './CallSignalRetry';
import type { PeerLookup } from './PeerLookup';
import type { PeerNegotiationState } from './PeerNegotiationState';
import type { PeerReplacement } from './PeerReplacement';

import { logCallDebug, logCallWarning } from './callDebugLogger';
import { descriptionFingerprint } from './descriptionFingerprint';
import {
  descriptionPayload,
  type DescriptionSignalPayload,
  type SignalSender,
} from './descriptionPayload';

const retiredFingerprintLimit = 8;

export class CallPeerNegotiation {
  private readonly descriptionDeliveries = new WeakMap<
    RTCPeerConnection,
    symbol
  >();

  private readonly descriptionHandlings = new Map<string, Promise<void>>();

  private readonly pendingAnswers = new WeakMap<
    RTCPeerConnection,
    Promise<void>
  >();

  private readonly states = new Map<string, PeerNegotiationState>();

  public constructor(
    private readonly peerFor: PeerLookup,
    private readonly replacePeer: PeerReplacement,
    private readonly signalRetry: CallSignalRetry,
    private readonly screenShareStreams: CallScreenShareStreams,
    private readonly localTracks: CallLocalTracks,
    private readonly encryption: CallMediaEncryption,
    private readonly iceCandidates: CallIceCandidates,
  ) {}

  private async applyDescriptionSignal(
    senderIdentityId: string,
    payload: DescriptionSignalPayload,
    sendSignal: SignalSender,
  ): Promise<void> {
    const description = new RTCSessionDescription(payload);
    const peer = await this.receivingConnection(
      senderIdentityId,
      description,
      sendSignal,
    );

    if (!peer) return;

    this.encryption.admit(senderIdentityId, peer);
    this.screenShareStreams.rememberRemoteMetadata(senderIdentityId, payload);
    await peer.setRemoteDescription(description);
    logCallDebug('peer-manager:handle-signal:remote-description-set', {
      screenStreamCount: payload.screenStreamIds?.length ?? 0,
      screenTrackCount: payload.screenTrackIds?.length ?? 0,
      senderIdentityId,
      signalType: description.type,
    });
    await this.iceCandidates.flush(senderIdentityId, peer);

    if (description.type !== 'offer') return;

    const answer = await peer.createAnswer();

    await peer.setLocalDescription(answer);
    logCallDebug('peer-manager:handle-signal:send-answer', {
      senderIdentityId,
    });
    await this.sendDescription(senderIdentityId, peer, answer, sendSignal);
  }

  /**
   * A polite offer during glare may mean ours never arrived, e.g. its
   * recovery asking for one; deliver ours again so it can answer.
   */
  private async redeliverAfterIgnoredOffer(
    senderIdentityId: string,
    peer: RTCPeerConnection,
    state: PeerNegotiationState,
    sendSignal: SignalSender,
  ): Promise<void> {
    if (!state.ignoreOffer) return;

    await this.resendUnansweredOffer(senderIdentityId, peer, sendSignal);
  }

  /**
   * Closes the connection to a peer and opens a fresh one for what comes
   * next. `retiring` are the fingerprints of the remote connections that
   * will not be heard from again.
   */
  private async replaceConnection(
    senderIdentityId: string,
    retiring: Array<string | undefined>,
    sendSignal: SignalSender,
  ): Promise<RTCPeerConnection> {
    const state = this.state(senderIdentityId);

    this.states.set(senderIdentityId, {
      ignoreOffer: false,
      makingOffer: false,
      polite: state.polite,
      retiredFingerprints: [
        ...state.retiredFingerprints,
        ...retiring.filter((fingerprint) => fingerprint !== undefined),
      ].slice(-retiredFingerprintLimit),
    });
    logCallWarning('peer-manager:handle-signal:replaced-connection', {
      retiredCount: retiring.length,
      senderIdentityId,
    });

    return await this.replacePeer(senderIdentityId, sendSignal);
  }

  /** The connection an answer is applied on, or none when it is left alone. */
  private async connectionForAnswer(
    senderIdentityId: string,
    peer: RTCPeerConnection,
    description: RTCSessionDescription,
    sendSignal: SignalSender,
  ): Promise<RTCPeerConnection | undefined> {
    const state = this.state(senderIdentityId);

    if (
      !['have-local-offer', 'have-remote-pranswer'].includes(
        peer.signalingState,
      )
    ) {
      await this.redeliverAfterIgnoredOffer(
        senderIdentityId,
        peer,
        state,
        sendSignal,
      );

      return undefined;
    }

    state.ignoreOffer = false;

    if (!this.isNewConnection(peer, description)) return peer;

    // This answer is for a connection that no longer exists: offer again.
    const replacement = await this.replaceConnection(
      senderIdentityId,
      [
        descriptionFingerprint(peer.remoteDescription),
        descriptionFingerprint(description),
      ],
      sendSignal,
    );

    await this.offerIfNeeded(senderIdentityId, replacement, true, sendSignal);

    return undefined;
  }

  /**
   * The connection an offer is applied on, or none when it is left alone.
   * An offer that collides with ours is ignored by the impolite peer and
   * answered by the polite one on a fresh connection, for a connection that
   * rolled back its own offer would never run its frame transforms again in
   * Chromium and WebKit.
   */
  private async connectionForOffer(
    senderIdentityId: string,
    peer: RTCPeerConnection,
    description: RTCSessionDescription,
    sendSignal: SignalSender,
  ): Promise<RTCPeerConnection | undefined> {
    const state = this.state(senderIdentityId);

    const collision = state.makingOffer || peer.signalingState !== 'stable';

    state.ignoreOffer = !state.polite && collision;

    if (state.ignoreOffer) {
      logCallWarning('peer-manager:handle-signal:ignored-glare-offer', {
        senderIdentityId,
        signalingState: peer.signalingState,
      });
      await this.redeliverAfterIgnoredOffer(
        senderIdentityId,
        peer,
        state,
        sendSignal,
      );

      return undefined;
    }

    const fromNewConnection = this.isNewConnection(peer, description);

    if (!fromNewConnection && !collision) return peer;

    return await this.replaceConnection(
      senderIdentityId,
      fromNewConnection ? [descriptionFingerprint(peer.remoteDescription)] : [],
      sendSignal,
    );
  }

  /**
   * Whether `description` is of a remote connection this connection
   * negotiated with before, but is not the one it negotiated with: a
   * connection cannot take another DTLS certificate of the remote peer.
   */
  private isNewConnection(
    peer: RTCPeerConnection,
    description: RTCSessionDescription,
  ): boolean {
    const established = descriptionFingerprint(peer.remoteDescription);
    const fingerprint = descriptionFingerprint(description);

    return (
      established !== undefined &&
      fingerprint !== undefined &&
      fingerprint !== established
    );
  }

  private isRetired(
    state: PeerNegotiationState,
    peer: RTCPeerConnection,
    description: RTCSessionDescription,
  ): boolean {
    const fingerprint = descriptionFingerprint(description);

    return (
      fingerprint !== undefined &&
      fingerprint !== descriptionFingerprint(peer.remoteDescription) &&
      state.retiredFingerprints.includes(fingerprint)
    );
  }

  /**
   * The connection `description` is to be applied on, or none when it is to
   * be left alone: a description of a retired remote connection is dropped,
   * one of another remote connection than the one this connection negotiated
   * with, or an offer that collides, is met by a fresh connection.
   */
  private async receivingConnection(
    senderIdentityId: string,
    description: RTCSessionDescription,
    sendSignal: SignalSender,
  ): Promise<RTCPeerConnection | undefined> {
    const peer = this.peerFor(senderIdentityId);

    if (!peer) return undefined;

    const state = this.state(senderIdentityId);

    if (this.isRetired(state, peer, description)) {
      logCallWarning('peer-manager:handle-signal:dropped-retired-description', {
        senderIdentityId,
        signalType: description.type,
      });

      return undefined;
    }

    return description.type === 'answer'
      ? await this.connectionForAnswer(
          senderIdentityId,
          peer,
          description,
          sendSignal,
        )
      : await this.connectionForOffer(
          senderIdentityId,
          peer,
          description,
          sendSignal,
        );
  }

  private async sendDescription(
    peerIdentityId: string,
    peer: RTCPeerConnection,
    description: RTCSessionDescriptionInit,
    sendSignal: SignalSender,
  ): Promise<void> {
    const delivery = Symbol();

    this.descriptionDeliveries.set(peer, delivery);
    const sending = this.signalRetry.send(
      () =>
        sendSignal(
          peerIdentityId,
          description.type as 'offer' | 'answer',
          descriptionPayload(
            peer.localDescription ?? description,
            this.screenShareStreams.localAudioTrackIds(this.localTracks.stream),
            this.screenShareStreams.localAudioStreamIds(
              this.localTracks.stream,
            ),
            this.screenShareStreams.localVideoTrackIds(this.localTracks.stream),
            this.screenShareStreams.localVideoStreamIds(
              this.localTracks.stream,
            ),
            this.encryption.localMetadata(),
          ),
        ),
      () =>
        this.peerFor(peerIdentityId) === peer &&
        peer.connectionState !== 'closed' &&
        peer.localDescription?.type === description.type &&
        this.descriptionDeliveries.get(peer) === delivery,
    );

    if (description.type === 'answer') this.pendingAnswers.set(peer, sending);

    try {
      await sending;
    } finally {
      if (this.pendingAnswers.get(peer) === sending)
        this.pendingAnswers.delete(peer);
    }
  }

  public configureState(peerIdentityId: string, polite: boolean): void {
    const current = this.state(peerIdentityId);

    current.polite = polite;
  }

  public forget(peerIdentityId: string): void {
    this.states.delete(peerIdentityId);
  }

  /**
   * Descriptions are applied one at a time per remote peer, whichever of its
   * connections they are for: a re-sent offer may arrive while its first copy
   * is still being answered, or while the connection it was for is replaced.
   */
  public async handleDescriptionSignal(
    senderIdentityId: string,
    payload: DescriptionSignalPayload,
    sendSignal: SignalSender,
  ): Promise<void> {
    const previous =
      this.descriptionHandlings.get(senderIdentityId) ?? Promise.resolve();
    const handling = previous
      .catch(() => undefined)
      .then(() =>
        this.applyDescriptionSignal(senderIdentityId, payload, sendSignal),
      );

    this.descriptionHandlings.set(senderIdentityId, handling);

    try {
      await handling;
    } finally {
      if (this.descriptionHandlings.get(senderIdentityId) === handling)
        this.descriptionHandlings.delete(senderIdentityId);
    }
  }

  public async offerIfNeeded(
    peerIdentityId: string,
    peer: RTCPeerConnection,
    shouldOffer: boolean,
    sendSignal: SignalSender,
  ): Promise<void> {
    const state = this.state(peerIdentityId);

    if (!shouldOffer || peer.localDescription || state.makingOffer) {
      logCallDebug('peer-manager:ensure-peer:offer-skipped', {
        hasLocalDescription: Boolean(peer.localDescription),
        makingOffer: state.makingOffer,
        peerIdentityId,
        shouldOffer,
      });

      return;
    }

    try {
      state.makingOffer = true;
      const offer = await peer.createOffer();

      await peer.setLocalDescription(offer);
      logCallDebug('peer-manager:ensure-peer:send-offer', {
        peerIdentityId,
      });
      await this.sendDescription(peerIdentityId, peer, offer, sendSignal);
    } finally {
      state.makingOffer = false;
    }
  }

  public reset(): void {
    this.descriptionHandlings.clear();
    this.states.clear();
  }

  public async sendRenegotiationOffer(
    peerIdentityId: string,
    peer: RTCPeerConnection,
    sendSignal: SignalSender,
  ): Promise<void> {
    await this.pendingAnswers.get(peer);

    if (
      this.peerFor(peerIdentityId) !== peer ||
      peer.connectionState === 'closed'
    )
      return;

    const state = this.state(peerIdentityId);

    if (state.polite && !peer.localDescription && !peer.remoteDescription) {
      logCallDebug('peer-manager:renegotiation:initial-offer-deferred', {
        peerIdentityId,
      });

      return;
    }

    if (state.makingOffer || peer.signalingState !== 'stable') {
      logCallDebug('peer-manager:renegotiation:offer-skipped', {
        makingOffer: state.makingOffer,
        peerIdentityId,
        signalingState: peer.signalingState,
      });

      return;
    }

    try {
      state.makingOffer = true;
      const offer = await peer.createOffer();

      await peer.setLocalDescription(offer);
      await this.sendDescription(peerIdentityId, peer, offer, sendSignal);
    } finally {
      state.makingOffer = false;
    }
  }

  public state(peerIdentityId: string): PeerNegotiationState {
    const current = this.states.get(peerIdentityId);

    if (current) return current;

    const state = {
      ignoreOffer: false,
      makingOffer: false,
      polite: true,
      retiredFingerprints: [],
    };

    this.states.set(peerIdentityId, state);

    return state;
  }

  /**
   * Delivers a local offer the remote peer never answered once more. The
   * connection cannot leave `have-local-offer` without its answer, so an ICE
   * restart has no effect. A lost answer also left the remote peer in the
   * negotiated session, which only this same offer renegotiates consistently.
   * Resolves whether the offer was re-sent.
   */
  public async resendUnansweredOffer(
    peerIdentityId: string,
    peer: RTCPeerConnection,
    sendSignal: SignalSender,
  ): Promise<boolean> {
    const offer = peer.localDescription;

    if (
      peer.signalingState !== 'have-local-offer' ||
      !offer ||
      this.state(peerIdentityId).makingOffer
    )
      return false;

    logCallWarning('peer-manager:ice-recovery:resent-offer', {
      peerIdentityId,
    });
    await this.sendDescription(peerIdentityId, peer, offer, sendSignal);

    return true;
  }
}
