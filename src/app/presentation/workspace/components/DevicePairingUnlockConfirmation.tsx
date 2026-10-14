import type { ReactElement } from 'react';

import type { LocalUnlockConfirmation } from './useLocalUnlockConfirmation';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { ProfileInput } from './ProfileInput';

const passwordPlaceholder = '••••••••••••';

export function DevicePairingUnlockConfirmation({
  confirmation,
}: {
  confirmation: LocalUnlockConfirmation;
}): ReactElement {
  if (!confirmation.usesPassword) {
    return (
      <p className="text-xs font-semibold leading-relaxed text-white/60">
        {copy.profile.devicePairingPasskey}
      </p>
    );
  }

  return (
    <ProfileInput
      label={copy.profile.devicePairingPassword}
      onChange={confirmation.onPasswordChange}
      placeholder={passwordPlaceholder}
      testId="device-pairing-password-input"
      type="password"
      value={confirmation.password}
    />
  );
}
