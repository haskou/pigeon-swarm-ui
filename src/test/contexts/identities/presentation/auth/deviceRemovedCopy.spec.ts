import { en } from '../../../../../shared/presentation/i18n/en';
import { es } from '../../../../../shared/presentation/i18n/es';

describe('device removed copy', () => {
  it('tells the user in English that this device was removed', () => {
    expect(en.auth.deviceRemoved).toBe(
      'This device was removed from your account.',
    );
  });

  it('tells the user in Spanish that this device was removed', () => {
    expect(es.auth.deviceRemoved).toBe(
      'Este dispositivo fue eliminado de tu cuenta.',
    );
  });

  it('offers re-pairing and a local start over in both languages', () => {
    for (const copy of [en.auth, es.auth]) {
      expect(copy.deviceRemovedHelp.length).toBeGreaterThan(0);
      expect(copy.deviceRemovedPair.length).toBeGreaterThan(0);
      expect(copy.deviceRemovedStartOver.length).toBeGreaterThan(0);
    }
  });

  it('shows no request, signature, or credential details', () => {
    for (const text of [
      en.auth.deviceRemoved,
      en.auth.deviceRemovedHelp,
      es.auth.deviceRemoved,
      es.auth.deviceRemovedHelp,
    ]) {
      expect(text).not.toMatch(/401|signature|credential|request|invalid/i);
    }
  });
});
