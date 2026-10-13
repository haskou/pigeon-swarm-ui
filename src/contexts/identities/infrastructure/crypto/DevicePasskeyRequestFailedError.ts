import { copy } from '../../../../shared/presentation/i18n/copy';

export class DevicePasskeyRequestFailedError extends Error {
  public constructor() {
    super(copy.profile.passkeyRequestFailed);
    this.name = 'DevicePasskeyRequestFailedError';
  }
}
