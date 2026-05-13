import type { CallSignalType } from '../../domain/calls/CallSession';

type SignalSender = (
  recipientIdentityId: string,
  signalType: CallSignalType,
  payload: Record<string, unknown>,
) => Promise<void>;

const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

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

  private readonly remoteAudio = new Map<string, HTMLAudioElement>();

  private localStream: MediaStream | null = null;

  public setLocalStream(stream: MediaStream): void {
    this.localStream = stream;
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
      await peer.addIceCandidate(new RTCIceCandidate(payload));

      return;
    }

    const description = new RTCSessionDescription(
      payload as unknown as RTCSessionDescriptionInit,
    );

    await peer.setRemoteDescription(description);

    if (signalType !== 'offer') return;

    const answer = await peer.createAnswer();

    await peer.setLocalDescription(answer);
    await sendSignal(senderIdentityId, 'answer', descriptionPayload(answer));
  }

  public reset(): void {
    this.peers.forEach((peer) => peer.close());
    this.peers.clear();

    for (const audio of this.remoteAudio.values()) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    }
    this.remoteAudio.clear();
    this.localStream = null;
  }

  private getOrCreatePeer(
    peerIdentityId: string,
    sendSignal: SignalSender,
  ): RTCPeerConnection {
    const existing = this.peers.get(peerIdentityId);

    if (existing) return existing;

    const peer = new RTCPeerConnection({ iceServers });

    this.localStream?.getTracks().forEach((track) => {
      if (this.localStream) peer.addTrack(track, this.localStream);
    });
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
    audio.srcObject = stream;

    if (!this.remoteAudio.has(peerIdentityId)) {
      audio.dataset.peerIdentityId = peerIdentityId;
      audio.className = 'hidden';
      document.body.append(audio);
      this.remoteAudio.set(peerIdentityId, audio);
    }
    void audio.play().catch(() => undefined);
  }
}
