import type { CallIceCandidates } from './CallIceCandidates';
import type { CallLocalTracks } from './CallLocalTracks';
import type { CallMediaEncryption } from './CallMediaEncryption';
import type { CallScreenShareStreams } from './CallScreenShareStreams';
import type { CallSignalRetry } from './CallSignalRetry';
import type { PeerLookup } from './PeerLookup';
import type { PeerNegotiationState } from './PeerNegotiationState';

import { logCallDebug, logCallWarning } from './callDebugLogger';
import {
  descriptionPayload,
  type DescriptionSignalPayload,
  type SignalSender,
} from './descriptionPayload';

export class CallPeerNegotiation {
  private readonly descriptionDeliveries = new WeakMap<
    RTCPeerConnection,
    symbol
  >();

  private readonly pendingAnswers = new WeakMap<
    RTCPeerConnection,
    Promise<void>
  >();

  private readonly states = new Map<string, PeerNegotiationState>();

  public constructor(
    private readonly peerFor: PeerLookup,
    private readonly signalRetry: CallSignalRetry,
    private readonly screenShareStreams: CallScreenShareStreams,
    private readonly localTracks: CallLocalTracks,
    private readonly encryption: CallMediaEncryption,
    private readonly iceCandidates: CallIceCandidates,
  ) {}

  public configureState(peerIdentityId: string, polite: boolean): void {
    const current = this.state(peerIdentityId);

    current.polite = polite;
  }

  public forget(peerIdentityId: string): void {
    this.states.delete(peerIdentityId);
  }

  public async handleDescriptionSignal(
    senderIdentityId: string,
    peer: RTCPeerConnection,
    payload: DescriptionSignalPayload,
    state: PeerNegotiationState,
    sendSignal: SignalSender,
  ): Promise<void> {
    const description = new RTCSessionDescription(payload);
    const offerCollision = this.isOfferCollision(description, state, peer);
    const wasSendingEncryptedMedia =
      this.encryption.outboundEnabled(senderIdentityId);

    if (
      !this.acceptRemoteDescription(senderIdentityId, peer, state, description)
    ) {
      return;
    }

    this.encryption.rememberRemoteMetadata(
      senderIdentityId,
      payload,
      this.peerFor(senderIdentityId),
    );
    this.screenShareStreams.rememberRemoteMetadata(senderIdentityId, payload);
    await peer.setRemoteDescription(description);
    logCallDebug('peer-manager:handle-signal:remote-description-set', {
      screenStreamCount: payload.screenStreamIds?.length ?? 0,
      screenTrackCount: payload.screenTrackIds?.length ?? 0,
      senderIdentityId,
      signalType: description.type,
    });
    await this.iceCandidates.flush(senderIdentityId, peer);

    if (description.type !== 'offer') {
      if (
        !wasSendingEncryptedMedia &&
        this.encryption.outboundEnabled(senderIdentityId)
      ) {
        await this.sendRenegotiationOffer(senderIdentityId, peer, sendSignal);
      }

      return;
    }

    const answer = await peer.createAnswer();

    await peer.setLocalDescription(answer);

    if (offerCollision) {
      await this.localTracks.rebindAudioSenders(senderIdentityId, peer);
    }
    logCallDebug('peer-manager:handle-signal:send-answer', {
      senderIdentityId,
    });
    await this.sendDescription(senderIdentityId, peer, answer, sendSignal);
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
    };

    this.states.set(peerIdentityId, state);

    return state;
  }

  private acceptRemoteDescription(
    senderIdentityId: string,
    peer: RTCPeerConnection,
    state: PeerNegotiationState,
    description: RTCSessionDescription,
  ): boolean {
    const negotiationState = state;

    if (
      description.type === 'answer' &&
      !['have-local-offer', 'have-remote-pranswer'].includes(
        peer.signalingState,
      )
    ) {
      return false;
    }

    if (description.type !== 'offer') {
      negotiationState.ignoreOffer = false;

      return true;
    }

    const offerCollision = this.isOfferCollision(
      description,
      negotiationState,
      peer,
    );

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
    }

    return true;
  }

  private isOfferCollision(
    description: RTCSessionDescriptionInit,
    state: PeerNegotiationState,
    peer: RTCPeerConnection,
  ): boolean {
    return (
      description.type === 'offer' &&
      (state.makingOffer || peer.signalingState !== 'stable')
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
            this.encryption.localMetadata(peerIdentityId),
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
}
