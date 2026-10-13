import { copy } from '../../../../shared/presentation/i18n/copy';

export class DevicePasskeyPrfUnavailableError extends Error {
  public constructor() {
    super(copy.profile.passkeyPrfUnavailable);
    this.name = 'DevicePasskeyPrfUnavailableError';
  }
}
