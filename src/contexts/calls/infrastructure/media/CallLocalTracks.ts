import type { CallMediaEncryption } from './CallMediaEncryption';
import type { CallScreenShareStreams } from './CallScreenShareStreams';
import type { PeerLookup } from './PeerLookup';
import type { ScreenShareQualityPreset } from './ScreenShareQualityPreset';

import { logCallDebug, logCallError, logCallWarning } from './callDebugLogger';
import {
  isScreenShareTrack,
  replacementLocalTrack,
} from './callMediaTrackClassification';
import { screenShareEncodingParameters } from './ScreenShareQuality';

export class CallLocalTracks {
  private localStream: MediaStream | null = null;
  private screenShareQuality: ScreenShareQualityPreset = 'auto';

  public constructor(
    private readonly peerFor: PeerLookup,
    private readonly screenShareStreams: CallScreenShareStreams,
    private readonly encryption: CallMediaEncryption,
  ) {}

  private addMissingTrack(
    peer: RTCPeerConnection,
    track: MediaStreamTrack,
    syncedTracks: Set<MediaStreamTrack>,
  ): void {
    if (!this.localStream || this.hasSender(peer, track, syncedTracks)) {
      return;
    }

    this.addTrack(peer, track);
  }

  private addTrack(peer: RTCPeerConnection, track: MediaStreamTrack): void {
    // A private call this browser failed to encrypt sends nothing more.
    if (this.encryption.failed) return;

    const sender = peer.addTrack(
      track,
      this.screenShareStreams.localStreamFor(track, this.localStream),
    );

    // Chromium passes the frames of a sender or receiver that has no
    // transform once the task creating it ends, even if one comes later.
    this.encryption.syncPeer(peer);
    this.configureScreenShareQuality(sender);
  }

  private configureScreenShareQuality(sender: RTCRtpSender): void {
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

  private configureSender(sender: RTCRtpSender): void {
    this.encryption.configureSender(sender);
    this.configureScreenShareQuality(sender);
  }

  private hasSender(
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

  private syncPeer(
    peer: RTCPeerConnection,
    activeTracks: MediaStreamTrack[],
  ): void {
    const activeTrackSet = new Set(activeTracks);
    const syncedTracks = new Set<MediaStreamTrack>();

    for (const sender of peer.getSenders()) {
      this.syncSender(peer, sender, activeTracks, activeTrackSet, syncedTracks);
    }

    for (const track of activeTracks) {
      this.addMissingTrack(peer, track, syncedTracks);
    }
  }

  private syncPeers(peers: Map<string, RTCPeerConnection>): void {
    const activeTracks = this.localStream?.getTracks() ?? [];

    for (const peer of peers.values()) this.syncPeer(peer, activeTracks);
  }

  private syncSender(
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
      .then(() => this.configureSender(sender))
      .catch((error: unknown) => {
        logCallError('peer-manager:replace-local-track-failed', error, {
          kind: replacement.kind,
        });
      });
  }

  public get stream(): MediaStream | null {
    return this.localStream;
  }

  public addToPeer(peer: RTCPeerConnection, peerIdentityId: string): void {
    this.localStream?.getTracks().forEach((track) => {
      logCallDebug('peer-manager:create-peer:add-local-track', {
        enabled: track.enabled,
        kind: track.kind,
        peerIdentityId,
        readyState: track.readyState,
      });

      this.addTrack(peer, track);
    });
  }

  public async rebindAudioSenders(
    peerIdentityId: string,
    peer: RTCPeerConnection,
  ): Promise<void> {
    if (
      this.peerFor(peerIdentityId) !== peer ||
      peer.connectionState === 'closed'
    )
      return;

    await Promise.all(
      peer.getSenders().map((sender) => {
        const track = sender.track;

        if (
          track?.kind !== 'audio' ||
          track.readyState !== 'live' ||
          !this.localStream?.getTracks().includes(track)
        )
          return;

        return sender.replaceTrack(track);
      }),
    );
  }

  public reset(): void {
    this.localStream = null;
  }

  public setScreenShareQuality(
    quality: ScreenShareQualityPreset,
    peers: Map<string, RTCPeerConnection>,
  ): void {
    this.screenShareQuality = quality;

    for (const peer of peers.values()) {
      peer.getSenders().forEach((sender) => this.configureSender(sender));
    }
  }

  public setStream(
    stream: MediaStream | null,
    peers: Map<string, RTCPeerConnection>,
  ): void {
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
    this.syncPeers(peers);
  }
}
