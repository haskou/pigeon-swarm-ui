import type { BrowserWindowWithWebkitAudioContext } from './BrowserWindowWithWebkitAudioContext';
import type { RemoteAudioElementHost } from './RemoteAudioElementHost';

import { logCallDebug, logCallError } from './callDebugLogger';
import {
  graphAudioVolume,
  isMediaStreamSource,
  nativeAudioVolume,
  needsAudioGraph,
  remoteAudioKey,
} from './remoteAudioOutput';

export class RemoteCallAudio {
  private readonly audioElements = new Map<string, HTMLAudioElement>();

  private readonly audioContexts = new Map<string, AudioContext>();

  private readonly gains = new Map<string, GainNode>();

  private readonly outputSources = new Map<
    string,
    MediaStreamAudioSourceNode
  >();

  private readonly outputStreams = new Map<string, MediaStream>();

  private readonly streams = new Map<string, MediaStream>();

  private readonly volumes = new Map<string, number>();

  private deafened = false;

  public constructor(
    private readonly audioElementHost: RemoteAudioElementHost,
  ) {}

  private playTrack(audioKey: string, track: MediaStreamTrack): void {
    const stream = this.streams.get(audioKey) ?? new MediaStream();

    if (
      !stream.getAudioTracks().some((audioTrack) => audioTrack.id === track.id)
    ) {
      stream.addTrack(track);
    }

    this.streams.set(audioKey, stream);
    track.addEventListener('ended', () => {
      stream.removeTrack(track);

      if (stream.getAudioTracks().length > 0) {
        this.playStream(audioKey, stream);

        return;
      }

      this.streams.delete(audioKey);
      this.resetOutput(audioKey);
      this.removeAudioElement(audioKey);
    });
    this.playStream(audioKey, stream);
  }

  private setChannelVolume(audioKey: string, volumePercent: number): void {
    const volume = Math.min(3, Math.max(0, volumePercent / 100));

    this.volumes.set(audioKey, volume);
    const audio = this.audioElements.get(audioKey);
    const gain = this.gains.get(audioKey);

    if (audio) {
      if (isMediaStreamSource(audio.srcObject)) {
        this.syncOutput(audioKey, audio.srcObject, volume);
      }

      audio.volume =
        gain || this.gains.has(audioKey) ? 0 : nativeAudioVolume(volume);
    }

    this.applyOutputVolume(audioKey, volume);
  }

  private playStream(audioKey: string, stream: MediaStream): void {
    const audio =
      this.audioElements.get(audioKey) ?? this.audioElementHost.create();
    const volume = this.volumes.get(audioKey) ?? 1;

    audio.autoplay = true;
    audio.muted = this.deafened;
    audio.srcObject = stream;

    if (!this.audioElements.has(audioKey)) {
      audio.dataset.peerIdentityId = audioKey;
      audio.className = 'hidden';
      this.audioElementHost.mount(audio);
      this.audioElements.set(audioKey, audio);
    }

    this.syncOutput(audioKey, stream, volume);
    audio.volume = this.gains.has(audioKey) ? 0 : nativeAudioVolume(volume);
    logCallDebug('remote-call-audio:play-requested', {
      audioKey,
      deafened: this.deafened,
      trackCount: stream.getTracks().length,
    });

    if (this.deafened) {
      audio.pause();

      return;
    }

    void audio.play().catch((error: unknown) => {
      logCallError('remote-call-audio:play-failed', error, { audioKey });
    });
  }

  private syncOutput(
    audioKey: string,
    stream: MediaStream,
    volume: number,
  ): void {
    if (this.outputStreams.get(audioKey) !== stream) this.resetOutput(audioKey);

    if (this.gains.has(audioKey)) {
      this.applyOutputVolume(audioKey, volume);

      return;
    }

    if (needsAudioGraph(volume)) this.createOutput(audioKey, stream, volume);
  }

  private createOutput(
    audioKey: string,
    stream: MediaStream,
    volume: number,
  ): void {
    const AudioContextConstructor =
      typeof window === 'undefined'
        ? undefined
        : (window.AudioContext ??
          (window as BrowserWindowWithWebkitAudioContext).webkitAudioContext);

    if (!AudioContextConstructor) return;

    try {
      const audioContext = new AudioContextConstructor();
      const source = audioContext.createMediaStreamSource(stream);
      const gain = audioContext.createGain();

      gain.gain.value = graphAudioVolume(volume, this.deafened);
      source.connect(gain).connect(audioContext.destination);
      this.audioContexts.set(audioKey, audioContext);
      this.gains.set(audioKey, gain);
      this.outputSources.set(audioKey, source);
      this.outputStreams.set(audioKey, stream);
      void audioContext.resume().catch(() => undefined);
    } catch (error) {
      logCallError('remote-call-audio:gain-setup-failed', error, { audioKey });
    }
  }

  private applyOutputVolume(audioKey: string, volume: number): void {
    const gain = this.gains.get(audioKey);

    if (!gain) return;

    gain.gain.setValueAtTime(
      graphAudioVolume(volume, this.deafened),
      this.audioContexts.get(audioKey)?.currentTime ?? 0,
    );
    void this.audioContexts
      .get(audioKey)
      ?.resume()
      .catch(() => undefined);
  }

  private resetOutput(audioKey: string): void {
    this.outputSources.get(audioKey)?.disconnect();
    void this.audioContexts
      .get(audioKey)
      ?.close()
      .catch(() => undefined);
    this.outputSources.delete(audioKey);
    this.gains.delete(audioKey);
    this.audioContexts.delete(audioKey);
    this.outputStreams.delete(audioKey);
  }

  private removeChannel(audioKey: string): void {
    this.streams.delete(audioKey);
    this.resetOutput(audioKey);
    this.removeAudioElement(audioKey);
    this.volumes.delete(audioKey);
  }

  private removeAudioElement(audioKey: string): void {
    const audio = this.audioElements.get(audioKey);

    if (!audio) return;

    audio.pause();
    audio.srcObject = null;
    audio.remove();
    this.audioElements.delete(audioKey);
  }

  public playVoiceTrack(peerIdentityId: string, track: MediaStreamTrack): void {
    this.playTrack(remoteAudioKey(peerIdentityId, 'voice'), track);
  }

  public playVoiceStream(peerIdentityId: string, stream: MediaStream): void {
    this.playStream(remoteAudioKey(peerIdentityId, 'voice'), stream);
  }

  public playScreenTrack(
    peerIdentityId: string,
    track: MediaStreamTrack,
  ): void {
    this.playTrack(remoteAudioKey(peerIdentityId, 'screen'), track);
  }

  public setVoiceVolume(peerIdentityId: string, volumePercent: number): void {
    this.setChannelVolume(
      remoteAudioKey(peerIdentityId, 'voice'),
      volumePercent,
    );
  }

  public setScreenVolume(peerIdentityId: string, volumePercent: number): void {
    this.setChannelVolume(
      remoteAudioKey(peerIdentityId, 'screen'),
      volumePercent,
    );
  }

  public setDeafened(deafened: boolean): void {
    this.deafened = deafened;
    logCallDebug('remote-call-audio:set-deafened', {
      audioCount: this.audioElements.size,
      deafened,
    });

    for (const [audioKey, audio] of this.audioElements.entries()) {
      const hasAudioGraph = this.gains.has(audioKey);

      audio.muted = deafened;
      this.applyOutputVolume(audioKey, this.volumes.get(audioKey) ?? 1);

      if (hasAudioGraph) continue;

      if (deafened) {
        audio.pause();
      } else {
        void audio.play().catch(() => undefined);
      }
    }
  }

  public removePeer(peerIdentityId: string): void {
    this.removeChannel(remoteAudioKey(peerIdentityId, 'voice'));
    this.removeChannel(remoteAudioKey(peerIdentityId, 'screen'));
  }

  public removeScreen(peerIdentityId: string): void {
    this.removeChannel(remoteAudioKey(peerIdentityId, 'screen'));
  }

  public reset(): void {
    for (const audio of this.audioElements.values()) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    }
    for (const source of this.outputSources.values()) source.disconnect();
    for (const audioContext of this.audioContexts.values()) {
      void audioContext.close().catch(() => undefined);
    }

    this.audioElements.clear();
    this.audioContexts.clear();
    this.gains.clear();
    this.outputSources.clear();
    this.outputStreams.clear();
    this.streams.clear();
    this.volumes.clear();
    this.deafened = false;
  }
}
