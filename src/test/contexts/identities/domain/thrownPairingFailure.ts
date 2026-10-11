import type { DevicePairingFailure } from '../../../../contexts/identities/domain/DevicePairingFailure';

import { DevicePairingError } from '../../../../contexts/identities/domain/DevicePairingError';

/**
 * Returns the failure kind an action throws, or undefined when it does not
 * throw a pairing error. Specs use it to pin why a code was rejected, not only
 * that it was.
 */
export function thrownPairingFailure(
  action: () => unknown,
): DevicePairingFailure | undefined {
  try {
    action();
  } catch (error) {
    return error instanceof DevicePairingError ? error.failure : undefined;
  }

  return undefined;
}
