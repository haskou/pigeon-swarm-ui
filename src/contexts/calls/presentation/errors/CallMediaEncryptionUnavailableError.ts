import type { CallMediaEncryptionUnavailableReason } from '../view-models/CallMediaEncryptionUnavailableReason';

import { copy } from '../../../../shared/presentation/i18n/copy';

/**
 * A private call whose media this device cannot encrypt is refused: it is
 * never started, joined or continued without media E2EE.
 */
export class CallMediaEncryptionUnavailableError extends Error {
  public constructor(
    reason: Extract<
      CallMediaEncryptionUnavailableReason,
      'missing-key' | 'unsupported'
    >,
  ) {
    super(
      reason === 'unsupported'
        ? copy.calls.mediaEncryptionUnsupported
        : copy.calls.mediaEncryptionMissingKey,
    );
    this.name = 'CallMediaEncryptionUnavailableError';
  }
}
