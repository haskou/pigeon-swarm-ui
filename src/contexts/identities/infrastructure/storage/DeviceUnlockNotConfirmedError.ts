import { copy } from '../../../../shared/presentation/i18n/copy';

export class DeviceUnlockNotConfirmedError extends Error {
  public constructor() {
    super(copy.profile.unlockNotConfirmed);
    this.name = 'DeviceUnlockNotConfirmedError';
  }
}
