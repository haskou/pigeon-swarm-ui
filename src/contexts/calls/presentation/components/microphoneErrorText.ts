import type { CallSession } from '../view-models/CallSession';

import { copy } from '../../../../shared/presentation/i18n/copy';

const microphoneErrorTexts: Record<
  NonNullable<CallSession['microphoneError']>,
  string
> = {
  constraint: copy.calls.microphoneConstraint,
  denied: copy.calls.microphoneDenied,
  'in-use': copy.calls.microphoneInUse,
  'missing-device': copy.calls.microphoneMissingDevice,
  'not-secure': copy.calls.microphoneNotSecure,
  security: copy.calls.microphoneSecurity,
  unknown: copy.calls.microphoneUnknown,
  unsupported: copy.calls.microphoneUnsupported,
};

export function microphoneErrorText(
  error: CallSession['microphoneError'],
): string {
  return microphoneErrorTexts[error ?? 'unknown'];
}
