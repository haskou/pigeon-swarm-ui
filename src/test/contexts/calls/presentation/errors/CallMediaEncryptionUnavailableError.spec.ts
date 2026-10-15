import { CallMediaEncryptionUnavailableError } from '../../../../../contexts/calls/presentation/errors/CallMediaEncryptionUnavailableError';
import { en } from '../../../../../shared/presentation/i18n/en';
import { es } from '../../../../../shared/presentation/i18n/es';

describe(CallMediaEncryptionUnavailableError.name, () => {
  it.each([
    ['English', en.calls.mediaEncryptionUnsupported],
    ['Spanish', es.calls.mediaEncryptionUnsupported],
  ])(
    'does not send %s readers to one browser engine, since several can encrypt calls',
    (_language, refusal) => {
      expect(refusal).not.toMatch(/chromium|chrome|edge/i);
    },
  );
});
