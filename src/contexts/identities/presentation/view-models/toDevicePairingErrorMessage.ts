import type { DevicePairingFailure } from '../../domain/DevicePairingFailure';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { DevicePairingError } from '../../domain/DevicePairingError';

/**
 * Plain-language copy for a failed pairing step. Domain messages and
 * placeholders never reach the screen: unknown errors resolve to `fallback`.
 */
export function toDevicePairingErrorMessage(
  caught: unknown,
  fallback: string = copy.profile.devicePairingError,
): string {
  if (caught instanceof DevicePairingError) {
    return pairingFailureMessage(caught.failure);
  }

  if (caught instanceof HttpJsonError || caught instanceof TypeError) {
    return toUserErrorMessage(caught, fallback);
  }

  return fallback;
}

function pairingFailureMessage(failure: DevicePairingFailure): string {
  switch (failure) {
    case 'expired':
      return copy.profile.devicePairingExpired;
    case 'used':
      return copy.profile.devicePairingUsed;
    case 'mismatch':
      return copy.profile.devicePairingMismatch;
    case 'invalid':
      return copy.profile.devicePairingInvalid;
  }
}
