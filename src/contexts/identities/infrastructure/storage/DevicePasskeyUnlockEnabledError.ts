import { copy } from '../../../../shared/presentation/i18n/copy';

export class DevicePasskeyUnlockEnabledError extends Error {
  public constructor() {
    super(copy.profile.passkeyUnlockEnabled);
    this.name = 'DevicePasskeyUnlockEnabledError';
  }
}
