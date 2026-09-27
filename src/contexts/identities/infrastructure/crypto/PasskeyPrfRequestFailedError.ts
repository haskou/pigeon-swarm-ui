import { copy } from '../../../../shared/presentation/i18n/copy';

export class PasskeyPrfRequestFailedError extends Error {
  public constructor() {
    super(copy.auth.passkeyPrfRequestFailed);
    this.name = 'PasskeyPrfRequestFailedError';
  }
}
