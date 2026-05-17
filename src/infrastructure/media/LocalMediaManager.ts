import { logCallDebug, logCallError } from './callDebugLogger';

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

function describeTracks(stream: MediaStream): Array<Record<string, unknown>> {
  return stream.getTracks().map(describeTrack);
}

export class LocalMediaManager {
  private stream: MediaStream | null = null;

  private cameraTrack: MediaStreamTrack | null = null;

  private screenTrack: MediaStreamTrack | null = null;

  private audioContext: AudioContext | null = null;

  private analyser: AnalyserNode | null = null;

  private audioSamples: Uint8Array<ArrayBuffer> | null = null;

  public useStream(stream: MediaStream): MediaStream {
    this.stop();
    this.stream = stream;
    this.configureAudioAnalyser();
    logCallDebug('local-media:use-existing-stream', {
      tracks: describeTracks(stream),
    });

    return this.stream;
  }

  public async startAudio(): Promise<MediaStream> {
    logCallDebug('local-media:start-audio:requesting-permission', {
      hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
      hasMediaDevices: Boolean(navigator.mediaDevices),
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
        hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
        hasMediaDevices: Boolean(navigator.mediaDevices),
        isSecureContext: window.isSecureContext,
      });
      throw error;
    }

    logCallDebug('local-media:start-audio:granted', {
      tracks: describeTracks(this.stream),
    });
    this.configureAudioAnalyser();

    return this.stream;
  }

  public async enableCamera(): Promise<MediaStream> {
    const cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true,
    });
    const [track] = cameraStream.getVideoTracks();

    if (!track) throw new Error('Camera track unavailable.');

    this.replaceManagedTrack('camera', track);

    return this.currentStream();
  }

  public async enableScreenShare(): Promise<MediaStream> {
    const displayMedia = navigator.mediaDevices.getDisplayMedia;

    if (!displayMedia) throw new Error('Screen sharing unavailable.');

    const screenStream = await displayMedia.call(navigator.mediaDevices, {
      audio: false,
      video: true,
    });
    const [track] = screenStream.getVideoTracks();

    if (!track) throw new Error('Screen track unavailable.');

    this.replaceManagedTrack('screen', track);

    return this.currentStream();
  }

  public disableCamera(): MediaStream | null {
    this.cameraTrack?.stop();
    this.removeTrack(this.cameraTrack);
    this.cameraTrack = null;

    return this.stream;
  }

  public disableScreenShare(): MediaStream | null {
    this.screenTrack?.stop();
    this.removeTrack(this.screenTrack);
    this.screenTrack = null;

    return this.stream;
  }

  public hasCamera(): boolean {
    return this.cameraTrack?.readyState === 'live';
  }

  public hasScreenShare(): boolean {
    return this.screenTrack?.readyState === 'live';
  }

  public localAudioLevel(): number {
    if (!this.analyser || !this.audioSamples) return 0;

    this.analyser.getByteTimeDomainData(this.audioSamples);

    let total = 0;

    for (const sample of this.audioSamples) {
      const normalized = (sample - 128) / 128;

      total += normalized * normalized;
    }

    return Math.sqrt(total / this.audioSamples.length);
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

  public previewStream(): MediaStream | undefined {
    return this.stream ?? undefined;
  }

  public screenPreviewStream(): MediaStream | undefined {
    return this.screenTrack?.readyState === 'live'
      ? new MediaStream([this.screenTrack])
      : undefined;
  }

  public stop(): void {
    logCallDebug('local-media:stop', {
      hadStream: Boolean(this.stream),
      tracks: this.stream ? describeTracks(this.stream) : [],
    });
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.cameraTrack = null;
    this.screenTrack = null;
    this.analyser = null;
    this.audioSamples = null;
    void this.audioContext?.close().catch(() => undefined);
    this.audioContext = null;
  }

  private currentStream(): MediaStream {
    this.stream ??= new MediaStream();

    return this.stream;
  }

  private replaceManagedTrack(
    kind: 'camera' | 'screen',
    track: MediaStreamTrack,
  ): void {
    const current = kind === 'camera' ? this.cameraTrack : this.screenTrack;

    Object.assign(track, {
      contentHint: kind === 'camera' ? 'motion' : 'detail',
    });
    current?.stop();
    this.removeTrack(current);
    this.currentStream().addTrack(track);

    if (kind === 'camera') {
      this.cameraTrack = track;
    } else {
      this.screenTrack = track;
    }

    track.addEventListener('ended', () => {
      if (kind === 'camera') {
        this.disableCamera();
      } else {
        this.disableScreenShare();
      }
    });
  }

  private removeTrack(track: MediaStreamTrack | null): void {
    if (!track || !this.stream) return;

    this.stream.removeTrack(track);
  }

  private configureAudioAnalyser(): void {
    const audioTrack = this.stream?.getAudioTracks()[0];

    if (!this.stream || !audioTrack) return;

    const AudioContextConstructor = window.AudioContext;

    if (!AudioContextConstructor) return;

    this.audioContext = new AudioContextConstructor();
    const source = this.audioContext.createMediaStreamSource(
      new MediaStream([audioTrack]),
    );

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.audioSamples = new Uint8Array(this.analyser.fftSize);
    source.connect(this.analyser);
  }
}
