import {
  logCallDebug,
  logCallError,
} from './callDebugLogger';

export class LocalMediaManager {
  private stream: MediaStream | null = null;

  public useStream(stream: MediaStream): MediaStream {
    this.stop();
    this.stream = stream;
    logCallDebug('local-media:use-existing-stream', {
      tracks: describeTracks(stream),
    });

    return this.stream;
  }

  public async startAudio(): Promise<MediaStream> {
    logCallDebug('local-media:start-audio:requesting-permission', {
      hasMediaDevices: Boolean(navigator.mediaDevices),
      hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
      isSecureContext: window.isSecureContext,
      permissionApiAvailable: Boolean(navigator.permissions?.query),
    });

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    } catch (error) {
      logCallError('local-media:start-audio:failed', error, {
        hasMediaDevices: Boolean(navigator.mediaDevices),
        hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
        isSecureContext: window.isSecureContext,
      });
      throw error;
    }

    logCallDebug('local-media:start-audio:granted', {
      tracks: describeTracks(this.stream),
    });

    return this.stream;
  }

  public setMicrophoneMuted(muted: boolean): void {
    const audioTracks = this.stream?.getAudioTracks() ?? [];

    logCallDebug('local-media:set-microphone-muted', {
      muted,
      trackCount: audioTracks.length,
      tracks: audioTracks.map(describeTrack),
    });

    for (const audioTrack of audioTracks) audioTrack.enabled = !muted;
  }

  public stop(): void {
    logCallDebug('local-media:stop', {
      hadStream: Boolean(this.stream),
      tracks: this.stream ? describeTracks(this.stream) : [],
    });
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}

function describeTracks(stream: MediaStream): Array<Record<string, unknown>> {
  return stream.getTracks().map(describeTrack);
}

function describeTrack(track: MediaStreamTrack): Record<string, unknown> {
  return {
    enabled: track.enabled,
    id: track.id,
    kind: track.kind,
    label: track.label,
    muted: track.muted,
    readyState: track.readyState,
  };
}
