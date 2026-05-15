export class LocalMediaManager {
  private stream: MediaStream | null = null;

  public useStream(stream: MediaStream): MediaStream {
    this.stop();
    this.stream = stream;

    return this.stream;
  }

  public async startAudio(): Promise<MediaStream> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    return this.stream;
  }

  public setMicrophoneMuted(muted: boolean): void {
    const audioTracks = this.stream?.getAudioTracks() ?? [];

    for (const audioTrack of audioTracks) audioTrack.enabled = !muted;
  }

  public stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
