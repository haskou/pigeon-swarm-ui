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
    peerIdentityId: string,
    peer: RTCPeerConnection,
    track: MediaStreamTrack,
    syncedTracks: Set<MediaStreamTrack>,
  ): void {
    if (!this.localStream || this.hasSender(peer, track, syncedTracks)) {
      return;
    }

    this.configureSender(
      peer.addTrack(
        track,
        this.screenShareStreams.localStreamFor(track, this.localStream),
      ),
      peerIdentityId,
    );
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

  private configureSender(sender: RTCRtpSender, peerIdentityId: string): void {
    this.encryption.configureSender(sender, peerIdentityId);
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
    peerIdentityId: string,
    peer: RTCPeerConnection,
    activeTracks: MediaStreamTrack[],
  ): void {
    const activeTrackSet = new Set(activeTracks);
    const syncedTracks = new Set<MediaStreamTrack>();

    for (const sender of peer.getSenders()) {
      this.syncSender(
        peerIdentityId,
        peer,
        sender,
        activeTracks,
        activeTrackSet,
        syncedTracks,
      );
    }

    for (const track of activeTracks) {
      this.addMissingTrack(peerIdentityId, peer, track, syncedTracks);
    }
  }

  private syncPeers(peers: Map<string, RTCPeerConnection>): void {
    const activeTracks = this.localStream?.getTracks() ?? [];

    for (const [peerIdentityId, peer] of peers.entries()) {
      this.syncPeer(peerIdentityId, peer, activeTracks);
    }
  }

  private syncSender(
    peerIdentityId: string,
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
      .then(() => this.configureSender(sender, peerIdentityId))
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

      this.configureSender(
        peer.addTrack(
          track,
          this.screenShareStreams.localStreamFor(track, this.localStream),
        ),
        peerIdentityId,
      );
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

    for (const [peerIdentityId, peer] of peers.entries()) {
      peer
        .getSenders()
        .forEach((sender) => this.configureSender(sender, peerIdentityId));
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
