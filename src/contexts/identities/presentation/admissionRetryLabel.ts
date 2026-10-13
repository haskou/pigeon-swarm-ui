import type { IdentityAdmissionProgress } from '../infrastructure/http/IdentityAdmissionProgress';

import { copy } from '../../../shared/presentation/i18n/copy';

/** Busy-node notice shown while an identity publish re-mines its proof. */
export function admissionRetryLabel(
  progress: IdentityAdmissionProgress,
): string {
  return copy.network.admissionRetry
    .replace('{bits}', String(progress.difficultyBits))
    .replace('{attempt}', String(progress.attempt))
    .replace('{maximum}', String(progress.maximumAttempts));
}
