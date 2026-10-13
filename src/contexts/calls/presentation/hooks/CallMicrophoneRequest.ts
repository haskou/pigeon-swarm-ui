import type { CallMicrophoneErrorCode } from '../view-models/CallMicrophoneErrorCode';

export type CallMicrophoneRequest = {
  microphoneError?: CallMicrophoneErrorCode;
  stream: MediaStream | null;
};
