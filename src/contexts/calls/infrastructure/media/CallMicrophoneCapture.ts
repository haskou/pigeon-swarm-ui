import rnnoiseWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseSimdWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';
import rnnoiseWorkletPath from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';

import type { CallMicrophoneCaptureOptions } from './CallMicrophoneCaptureOptions';
import type { MicrophoneMediaDevices } from './MicrophoneMediaDevices';
import type { ProcessedMicrophoneStream } from './ProcessedMicrophoneStream';

import { logCallWarning } from './callDebugLogger';

const enhancedAudioConstraints = {
  autoGainControl: true,
  echoCancellation: true,
  noiseSuppression: true,
} satisfies MediaTrackConstraints;

const basicAudioConstraints = {
  autoGainControl: true,
  echoCancellation: true,
  noiseSuppression: false,
} satisfies MediaTrackConstraints;

const fallbackMediaConstraints = {
  audio: true,
  video: false,
} satisfies MediaStreamConstraints;

export class CallMicrophoneCapture {
  private static readonly processedStreams = new WeakMap<
    MediaStream,
    ProcessedMicrophoneStream
  >();

  private static rnnoiseBinary?: Promise<ArrayBuffer>;

  private static async processStream(
    stream: MediaStream,
  ): Promise<MediaStream> {
    const AudioContextConstructor =
      typeof window === 'undefined' ? undefined : window.AudioContext;

    if (!AudioContextConstructor || stream.getAudioTracks().length === 0) {
      return stream;
    }

    const audioContext = new AudioContextConstructor({ sampleRate: 48_000 });

    if (!audioContext.audioWorklet) {
      await audioContext.close().catch(() => undefined);

      return stream;
    }

    try {
      const { RnnoiseWorkletNode } =
        await import('@sapphi-red/web-noise-suppressor');
      const wasmBinary = await this.loadRnnoiseBinary();

      await audioContext.audioWorklet.addModule(rnnoiseWorkletPath);

      const source = audioContext.createMediaStreamSource(stream);
      const processor = new RnnoiseWorkletNode(audioContext, {
        maxChannels: Math.max(1, stream.getAudioTracks().length),
        wasmBinary,
      });
      const destination = audioContext.createMediaStreamDestination();

      source.connect(processor).connect(destination);
      this.configureStream(destination.stream);
      this.processedStreams.set(destination.stream, {
        audioContext,
        inputStream: stream,
        outputStream: destination.stream,
        processor,
        source,
      });

      return destination.stream;
    } catch (error) {
      logCallWarning('call-microphone-capture:rnnoise-unavailable', {
        error,
      });
      await audioContext.close().catch(() => undefined);

      return stream;
    }
  }

  private static loadRnnoiseBinary(): Promise<ArrayBuffer> {
    async function loadBinary(): Promise<ArrayBuffer> {
      const { loadRnnoise } = await import('@sapphi-red/web-noise-suppressor');

      return await loadRnnoise({
        simdUrl: rnnoiseSimdWasmPath,
        url: rnnoiseWasmPath,
      });
    }

    this.rnnoiseBinary ??= loadBinary();

    return this.rnnoiseBinary;
  }

  private static shouldRetryWithoutAudioProcessing(error: unknown): boolean {
    if (error instanceof TypeError) return true;

    if (!(error instanceof Error)) return false;

    return (
      error.name === 'ConstraintNotSatisfiedError' ||
      error.name === 'OverconstrainedError'
    );
  }

  public static mediaConstraints(
    options: CallMicrophoneCaptureOptions = {
      noiseCancellationEnabled: true,
    },
  ): MediaStreamConstraints {
    return {
      audio: {
        ...(options.noiseCancellationEnabled
          ? enhancedAudioConstraints
          : basicAudioConstraints),
      },
      video: false,
    };
  }

  public static async capture(
    mediaDevices: MicrophoneMediaDevices,
    options: CallMicrophoneCaptureOptions = {
      noiseCancellationEnabled: true,
    },
  ): Promise<MediaStream> {
    let stream: MediaStream;

    try {
      stream = this.configureStream(
        await mediaDevices.getUserMedia(this.mediaConstraints(options)),
      );
    } catch (error) {
      if (!this.shouldRetryWithoutAudioProcessing(error)) throw error;

      stream = this.configureStream(
        await mediaDevices.getUserMedia(fallbackMediaConstraints),
      );
    }

    return options.noiseCancellationEnabled
      ? await this.processStream(stream)
      : stream;
  }

  public static configureStream(stream: MediaStream): MediaStream {
    for (const track of stream.getAudioTracks()) {
      track.contentHint = 'speech';
    }

    return stream;
  }

  public static stop(stream: MediaStream | null): void {
    if (!stream) return;

    const processed = this.processedStreams.get(stream);

    if (!processed) {
      stream.getTracks().forEach((track) => track.stop());

      return;
    }

    this.processedStreams.delete(stream);
    processed.outputStream.getTracks().forEach((track) => track.stop());
    processed.inputStream.getTracks().forEach((track) => track.stop());
    processed.source.disconnect();
    processed.processor.disconnect();
    processed.processor.destroy();
    void processed.audioContext.close().catch(() => undefined);
  }

  public static stopAudio(stream: MediaStream | null): void {
    if (!stream) return;

    const processed = this.processedStreams.get(stream);

    if (!processed) {
      stream.getAudioTracks().forEach((track) => track.stop());

      return;
    }

    this.processedStreams.delete(stream);
    processed.outputStream.getAudioTracks().forEach((track) => track.stop());
    processed.inputStream.getTracks().forEach((track) => track.stop());
    processed.source.disconnect();
    processed.processor.disconnect();
    processed.processor.destroy();
    void processed.audioContext.close().catch(() => undefined);
  }
}
