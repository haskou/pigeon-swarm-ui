import { copy } from '../../../../shared/presentation/i18n/copy';

export class DevicePasskeyUnlockDisabledError extends Error {
  public constructor() {
    super(copy.profile.passkeyUnlockDisabled);
    this.name = 'DevicePasskeyUnlockDisabledError';
  }
}
