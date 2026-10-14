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

  it('says that this browser erased what it saved for the identity', () => {
    expect(en.auth.deviceRemovedHelp).toMatch(/were erased/i);
    expect(es.auth.deviceRemovedHelp).toMatch(/se han borrado/i);
  });

  it('offers re-pairing and an erase retry in both languages', () => {
    for (const copy of [en.auth, es.auth]) {
      expect(copy.deviceRemovedEraseFailed.length).toBeGreaterThan(0);
      expect(copy.deviceRemovedPair.length).toBeGreaterThan(0);
    }
  });

  it('tells the user when a node cannot prove this device is still authorized', () => {
    expect(en.auth.deviceAuthorizationUnproven).toMatch(/another node/i);
    expect(es.auth.deviceAuthorizationUnproven).toMatch(/otro nodo/i);
  });

  it('shows no request, signature, or credential details', () => {
    for (const text of [
      en.auth.deviceRemoved,
      en.auth.deviceRemovedEraseFailed,
      en.auth.deviceRemovedHelp,
      es.auth.deviceRemoved,
      es.auth.deviceRemovedEraseFailed,
      es.auth.deviceRemovedHelp,
    ]) {
      expect(text).not.toMatch(/401|signature|credential|request|invalid/i);
    }
  });
});
