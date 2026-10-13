import type { CallMicrophoneCaptureOptions } from '../../infrastructure/media/CallMicrophoneCaptureOptions';
import type { CallMicrophoneRequest } from './CallMicrophoneRequest';

import { CallMicrophoneCapture } from '../../infrastructure/media/CallMicrophoneCapture';
import { classifyCallMicrophoneError } from './classifyCallMicrophoneError';

/**
 * Calls start without a microphone when it cannot be captured, keeping the
 * reason so the call can explain it and offer a fix.
 */
export async function requestCallMicrophone(
  options: CallMicrophoneCaptureOptions,
): Promise<CallMicrophoneRequest> {
  try {
    return {
      stream: await CallMicrophoneCapture.capture(
        navigator.mediaDevices,
        options,
      ),
    };
  } catch (error) {
    return {
      microphoneError: classifyCallMicrophoneError(error),
      stream: null,
    };
  }
}
