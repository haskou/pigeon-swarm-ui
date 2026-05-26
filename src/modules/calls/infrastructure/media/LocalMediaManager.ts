import { logCallDebug, logCallError, logCallWarning } from './callDebugLogger';
import { CallMicrophoneCapture } from './CallMicrophoneCapture';

type LocalMediaOptions = {
  noiseCancellationEnabled: boolean;
};

type ScreenShareOptions = {
  audioEnabled: boolean;
};

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

  private microphoneStream: MediaStream | null = null;

  private cameraTrack: MediaStreamTrack | null = null;

  private screenTrack: MediaStreamTrack | null = null;

  private screenAudioTrack: MediaStreamTrack | null = null;

  private screenAudioSourceTrack: MediaStreamTrack | null = null;

  private screenPreviewStreamCache: MediaStream | null = null;

  private screenAudioContext: AudioContext | null = null;

  private screenAudioGain: GainNode | null = null;

  private screenAudioSource: MediaStreamAudioSourceNode | null = null;

  private audioContext: AudioContext | null = null;

  private analyser: AnalyserNode | null = null;

  private audioSamples: Uint8Array<ArrayBuffer> | null = null;

  private noiseCancellationEnabled = true;

  private screenAudioVolume = 1;

  public useStream(
    stream: MediaStream,
    options: LocalMediaOptions = { noiseCancellationEnabled: true },
  ): MediaStream {
    this.stop();
    this.noiseCancellationEnabled = options.noiseCancellationEnabled;
    this.microphoneStream = stream.getAudioTracks().length > 0 ? stream : null;
    this.stream = new MediaStream(stream.getTracks());
    this.configureAudioAnalyser();
    logCallDebug('local-media:use-existing-stream', {
      noiseCancellationEnabled: this.noiseCancellationEnabled,
      tracks: describeTracks(this.stream),
    });

    return this.stream;
  }

  public async startAudio(
    options: LocalMediaOptions = { noiseCancellationEnabled: true },
  ): Promise<MediaStream> {
    this.noiseCancellationEnabled = options.noiseCancellationEnabled;
    logCallDebug('local-media:start-audio:requesting-permission', {
      hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
      hasMediaDevices: Boolean(navigator.mediaDevices),
      isSecureContext: window.isSecureContext,
      noiseCancellationEnabled: this.noiseCancellationEnabled,
      permissionApiAvailable: Boolean(navigator.permissions?.query),
    });

    try {
      const microphoneStream = await CallMicrophoneCapture.capture(
        navigator.mediaDevices,
        { noiseCancellationEnabled: this.noiseCancellationEnabled },
      );

      this.replaceMicrophoneStream(microphoneStream);
    } catch (error) {
      logCallError('local-media:start-audio:failed', error, {
        hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
        hasMediaDevices: Boolean(navigator.mediaDevices),
        isSecureContext: window.isSecureContext,
      });
      throw error;
    }

    logCallDebug('local-media:start-audio:granted', {
      tracks: this.stream ? describeTracks(this.stream) : [],
    });
    this.configureAudioAnalyser();

    return this.currentStream();
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

  public async enableScreenShare(
    options: ScreenShareOptions = { audioEnabled: false },
  ): Promise<MediaStream> {
    const displayMedia = navigator.mediaDevices.getDisplayMedia;

    if (!displayMedia) throw new Error('Screen sharing unavailable.');

    const screenStream = await displayMedia.call(navigator.mediaDevices, {
      audio: options.audioEnabled,
      video: true,
    });
    const [track] = screenStream.getVideoTracks();
    const [audioTrack] = screenStream.getAudioTracks();

    if (!track) throw new Error('Screen track unavailable.');

    this.replaceScreenTracks(track, audioTrack ?? null);

    return this.currentStream();
  }

  public disableCamera(): MediaStream | null {
    this.cameraTrack?.stop();
    this.removeTrack(this.cameraTrack);
    this.cameraTrack = null;

    return this.stream;
  }

  public disableScreenShare(): MediaStream | null {
    this.stopScreenShareTracks();

    return this.stream;
  }

  public setScreenShareAudioVolume(volumePercent: number): void {
    const volume = Math.min(3, Math.max(0, volumePercent / 100));

    this.screenAudioVolume = volume;

    if (!this.screenAudioGain || !this.screenAudioContext) return;

    this.screenAudioGain.gain.setValueAtTime(
      volume,
      this.screenAudioContext.currentTime,
    );
  }

  private stopScreenShareTracks(): void {
    this.removeTrack(this.screenTrack);
    this.removeTrack(this.screenAudioTrack);
    this.screenTrack?.stop();
    this.screenAudioTrack?.stop();

    if (
      this.screenAudioSourceTrack &&
      this.screenAudioSourceTrack !== this.screenAudioTrack
    ) {
      this.screenAudioSourceTrack.stop();
    }

    this.screenTrack = null;
    this.screenAudioTrack = null;
    this.screenAudioSourceTrack = null;
    this.screenPreviewStreamCache = null;
    this.resetScreenAudioGraph();
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
    const audioTracks = this.microphoneStream?.getAudioTracks() ?? [];

    logCallDebug('local-media:set-microphone-muted', {
      muted,
      trackCount: audioTracks.length,
      tracks: audioTracks.map(describeTrack),
    });

    for (const audioTrack of audioTracks) audioTrack.enabled = !muted;
  }

  public async setNoiseCancellationEnabled(
    enabled: boolean,
  ): Promise<MediaStream | null> {
    if (!this.stream || !this.microphoneStream?.getAudioTracks().length) {
      this.noiseCancellationEnabled = enabled;

      return this.stream;
    }

    const microphoneEnabled =
      this.microphoneStream.getAudioTracks().some((track) => track.enabled) ||
      this.microphoneStream.getAudioTracks().length === 0;
    const microphoneStream = await CallMicrophoneCapture.capture(
      navigator.mediaDevices,
      { noiseCancellationEnabled: enabled },
    );

    for (const track of microphoneStream.getAudioTracks()) {
      track.enabled = microphoneEnabled;
    }

    this.replaceMicrophoneStream(microphoneStream);
    this.noiseCancellationEnabled = enabled;
    this.resetAudioAnalyser();
    this.configureAudioAnalyser();

    return this.stream;
  }

  public previewStream(): MediaStream | undefined {
    return this.stream ?? undefined;
  }

  public screenPreviewStream(): MediaStream | undefined {
    return this.screenTrack?.readyState === 'live'
      ? (this.screenPreviewStreamCache ??= new MediaStream([this.screenTrack]))
      : undefined;
  }

  public stop(): void {
    logCallDebug('local-media:stop', {
      hadStream: Boolean(this.stream),
      tracks: this.stream ? describeTracks(this.stream) : [],
    });
    CallMicrophoneCapture.stop(this.microphoneStream);
    this.stopScreenShareTracks();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.microphoneStream = null;
    this.cameraTrack = null;
    this.resetAudioAnalyser();
  }

  private currentStream(): MediaStream {
    this.stream ??= new MediaStream();

    return this.stream;
  }

  private replaceMicrophoneStream(microphoneStream: MediaStream): void {
    const stream = this.currentStream();

    this.microphoneStream?.getAudioTracks().forEach((track) => {
      stream.removeTrack(track);
    });
    CallMicrophoneCapture.stopAudio(this.microphoneStream);

    for (const track of microphoneStream.getAudioTracks()) {
      stream.addTrack(track);
    }

    this.microphoneStream = microphoneStream;
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

  private replaceScreenTracks(
    videoTrack: MediaStreamTrack,
    audioTrack: MediaStreamTrack | null,
  ): void {
    Object.assign(videoTrack, { contentHint: 'detail' });

    this.stopScreenShareTracks();
    this.currentStream().addTrack(videoTrack);

    const screenAudioTrack = audioTrack
      ? this.prepareScreenAudioTrack(audioTrack)
      : null;

    if (screenAudioTrack) this.currentStream().addTrack(screenAudioTrack);

    this.screenTrack = videoTrack;
    this.screenAudioTrack = screenAudioTrack;
    this.screenPreviewStreamCache = new MediaStream([videoTrack]);

    videoTrack.addEventListener('ended', () => this.disableScreenShare());
    audioTrack?.addEventListener('ended', () => {
      this.removeTrack(audioTrack);

      if (this.screenAudioSourceTrack === audioTrack) {
        this.removeTrack(this.screenAudioTrack);
        this.screenAudioTrack?.stop();
        this.screenAudioSourceTrack = null;
        this.screenAudioTrack = null;
        this.resetScreenAudioGraph();
      }
    });
  }

  private prepareScreenAudioTrack(
    audioTrack: MediaStreamTrack,
  ): MediaStreamTrack {
    Object.assign(audioTrack, { contentHint: 'music' });
    this.screenAudioSourceTrack = audioTrack;

    const AudioContextConstructor = window.AudioContext;

    if (!AudioContextConstructor) return audioTrack;

    try {
      const audioContext = new AudioContextConstructor();
      const source = audioContext.createMediaStreamSource(
        new MediaStream([audioTrack]),
      );
      const gain = audioContext.createGain();
      const destination = audioContext.createMediaStreamDestination();

      source.connect(gain);
      gain.connect(destination);

      this.screenAudioContext = audioContext;
      this.screenAudioSource = source;
      this.screenAudioGain = gain;
      this.setScreenShareAudioVolume(this.screenAudioVolume * 100);

      const [processedTrack] = destination.stream.getAudioTracks();

      if (!processedTrack) {
        this.resetScreenAudioGraph();

        return audioTrack;
      }

      Object.assign(processedTrack, { contentHint: 'music' });

      return processedTrack;
    } catch (error) {
      logCallWarning('local-media:screen-audio-gain-unavailable', {
        error,
      });
      this.resetScreenAudioGraph();

      return audioTrack;
    }
  }

  private removeTrack(track: MediaStreamTrack | null): void {
    if (!track || !this.stream) return;

    this.stream.removeTrack(track);
  }

  private configureAudioAnalyser(): void {
    const audioTrack = this.microphoneStream?.getAudioTracks()[0];

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

  private resetAudioAnalyser(): void {
    this.analyser = null;
    this.audioSamples = null;
    void this.audioContext?.close().catch(() => undefined);
    this.audioContext = null;
  }

  private resetScreenAudioGraph(): void {
    this.screenAudioSource?.disconnect();
    this.screenAudioGain?.disconnect();
    void this.screenAudioContext?.close().catch(() => undefined);
    this.screenAudioSource = null;
    this.screenAudioGain = null;
    this.screenAudioContext = null;
  }
}
