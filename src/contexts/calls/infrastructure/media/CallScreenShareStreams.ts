import type { DescriptionSignalPayload } from './DescriptionSignalPayload';

import { logCallDebug } from './callDebugLogger';
import {
  isRemoteScreenShareAudioTrack,
  isRemoteScreenShareTrack,
  isScreenShareAudioTrack,
  isScreenShareTrack,
} from './callMediaTrackClassification';
import { RemoteCallAudio } from './RemoteCallAudio';

export class CallScreenShareStreams {
  private readonly localStreams = new Map<string, MediaStream>();

  private readonly remoteAudioStreamIds = new Map<string, Set<string>>();

  private readonly remoteAudioTrackIds = new Map<string, Set<string>>();

  private readonly remoteStreams = new Map<string, MediaStream>();

  private readonly remoteStreamIds = new Map<string, Set<string>>();

  private readonly remoteTrackIds = new Map<string, Set<string>>();

  public constructor(private readonly remoteAudio: RemoteCallAudio) {}

  private localMediaStreamIdsFor(trackIds: string[]): string[] {
    const activeTrackIds = new Set(trackIds);
    const streamIds: string[] = [];

    for (const [trackId, stream] of this.localStreams.entries()) {
      if (activeTrackIds.has(trackId)) streamIds.push(stream.id);
    }

    return streamIds;
  }

  private handleRemoteAudioTrack(
    peerIdentityId: string,
    event: RTCTrackEvent,
  ): boolean {
    const isScreenAudio = isRemoteScreenShareAudioTrack(
      event.track,
      event.streams,
      this.remoteAudioTrackIds.get(peerIdentityId) ?? new Set(),
      this.remoteAudioStreamIds.get(peerIdentityId) ?? new Set(),
    );

    if (isScreenAudio) {
      this.remoteAudio.playScreenTrack(peerIdentityId, event.track);
    }

    return isScreenAudio;
  }

  private handleRemoteVideoTrack(
    peerIdentityId: string,
    event: RTCTrackEvent,
  ): boolean {
    const isScreenVideo = isRemoteScreenShareTrack(
      event.track,
      event.streams,
      this.remoteTrackIds.get(peerIdentityId) ?? new Set(),
      this.remoteStreamIds.get(peerIdentityId) ?? new Set(),
    );

    if (!isScreenVideo) return false;

    const screenStream = new MediaStream([event.track]);

    this.remoteStreams.set(peerIdentityId, screenStream);
    event.track.addEventListener('ended', () => {
      if (this.remoteStreams.get(peerIdentityId) === screenStream) {
        this.remoteStreams.delete(peerIdentityId);
      }
    });
    logCallDebug('peer-manager:screen-track-received', {
      peerIdentityId,
      trackId: event.track.id,
    });

    return true;
  }

  private rememberRemoteAudioMetadata(
    peerIdentityId: string,
    payload: DescriptionSignalPayload,
  ): void {
    this.remoteAudioTrackIds.set(
      peerIdentityId,
      new Set(payload.screenAudioTrackIds ?? []),
    );
    this.remoteAudioStreamIds.set(
      peerIdentityId,
      new Set(payload.screenAudioStreamIds ?? []),
    );

    if (
      !payload.screenAudioTrackIds?.length &&
      !payload.screenAudioStreamIds?.length
    ) {
      this.remoteAudio.removeScreen(peerIdentityId);
    }
  }

  private rememberRemoteVideoMetadata(
    peerIdentityId: string,
    payload: DescriptionSignalPayload,
  ): void {
    this.remoteTrackIds.set(
      peerIdentityId,
      new Set(payload.screenTrackIds ?? []),
    );
    this.remoteStreamIds.set(
      peerIdentityId,
      new Set(payload.screenStreamIds ?? []),
    );

    if (!payload.screenTrackIds?.length && !payload.screenStreamIds?.length) {
      this.remoteStreams.delete(peerIdentityId);
    }
  }

  public forget(peerIdentityId: string): void {
    this.remoteStreams.delete(peerIdentityId);
    this.remoteStreamIds.delete(peerIdentityId);
    this.remoteTrackIds.delete(peerIdentityId);
    this.remoteAudioStreamIds.delete(peerIdentityId);
    this.remoteAudioTrackIds.delete(peerIdentityId);
    this.remoteAudio.removeScreen(peerIdentityId);
  }

  public handleRemoteTrack(
    peerIdentityId: string,
    event: RTCTrackEvent,
  ): boolean {
    if (this.handleRemoteVideoTrack(peerIdentityId, event)) return true;

    return this.handleRemoteAudioTrack(peerIdentityId, event);
  }

  public localAudioStreamIds(localStream: MediaStream | null): string[] {
    return this.localMediaStreamIdsFor(this.localAudioTrackIds(localStream));
  }

  public localAudioTrackIds(localStream: MediaStream | null): string[] {
    return (
      localStream
        ?.getAudioTracks()
        .filter((track) => isScreenShareAudioTrack(track))
        .map((track) => track.id) ?? []
    );
  }

  public localStreamFor(
    track: MediaStreamTrack,
    localStream: MediaStream | null,
  ): MediaStream {
    if (!isScreenShareTrack(track) && !isScreenShareAudioTrack(track)) {
      return localStream ?? new MediaStream([track]);
    }

    const currentStream = this.localStreams.get(track.id);

    if (currentStream) return currentStream;

    const screenStream = new MediaStream([track]);

    this.localStreams.set(track.id, screenStream);

    return screenStream;
  }

  public localVideoStreamIds(localStream: MediaStream | null): string[] {
    return this.localMediaStreamIdsFor(this.localVideoTrackIds(localStream));
  }

  public localVideoTrackIds(localStream: MediaStream | null): string[] {
    return (
      localStream
        ?.getVideoTracks()
        .filter((track) => isScreenShareTrack(track))
        .map((track) => track.id) ?? []
    );
  }

  public rememberRemoteMetadata(
    peerIdentityId: string,
    payload: DescriptionSignalPayload,
  ): void {
    this.rememberRemoteVideoMetadata(peerIdentityId, payload);
    this.rememberRemoteAudioMetadata(peerIdentityId, payload);
  }

  public reset(): void {
    this.localStreams.clear();
    this.remoteStreams.clear();
    this.remoteStreamIds.clear();
    this.remoteTrackIds.clear();
    this.remoteAudioStreamIds.clear();
    this.remoteAudioTrackIds.clear();
  }

  public streams(): Record<string, MediaStream> {
    return Object.fromEntries(this.remoteStreams.entries());
  }
}
