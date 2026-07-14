import { TechnicalDetailsPreference } from '../../../../shared/presentation/preferences/TechnicalDetailsPreference';

describe('technicalDetailsPreference', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
  });

  it('is disabled by default', () => {
    expect(TechnicalDetailsPreference.enabled()).toBe(false);
  });

  it('persists the preference locally', () => {
    TechnicalDetailsPreference.update(true);

    expect(TechnicalDetailsPreference.enabled()).toBe(true);

    TechnicalDetailsPreference.update(false);

    expect(TechnicalDetailsPreference.enabled()).toBe(false);
  });

  it('treats unknown stored values as disabled', () => {
    storage.set('pigeon-swarm-technical-details-v1', 'yes');

    expect(TechnicalDetailsPreference.enabled()).toBe(false);
  });
});
