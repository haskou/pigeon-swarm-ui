import type { CallMicrophoneErrorCode } from '../view-models/CallMicrophoneErrorCode';

export function classifyCallMicrophoneError(
  error: unknown,
): CallMicrophoneErrorCode {
  if (!window.isSecureContext) return 'not-secure';
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  if (!(error instanceof Error)) return 'unknown';
  if (error.name === 'NotAllowedError') return 'denied';
  if (error.name === 'NotFoundError') return 'missing-device';
  if (error.name === 'NotReadableError') return 'in-use';
  if (error.name === 'OverconstrainedError') return 'constraint';
  if (error.name === 'SecurityError') return 'security';
  if (error instanceof TypeError) return 'unsupported';

  return 'unknown';
}
