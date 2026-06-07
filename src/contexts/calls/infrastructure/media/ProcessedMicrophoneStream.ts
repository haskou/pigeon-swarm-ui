import type { RnnoiseWorkletNode } from '@sapphi-red/web-noise-suppressor';

export type ProcessedMicrophoneStream = {
  audioContext: AudioContext;
  inputStream: MediaStream;
  outputStream: MediaStream;
  processor: RnnoiseWorkletNode;
  source: MediaStreamAudioSourceNode;
};
