import {
  loadCallMediaEncryptionEnabled,
  loadCallNoiseCancellationEnabled,
  saveCallMediaEncryptionEnabled,
  saveCallNoiseCancellationEnabled,
} from '../../../../../contexts/calls/infrastructure/storage/callAudioPreference';

describe('callAudioPreference', () => {
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

  it('enables noise cancellation by default', () => {
    expect(loadCallNoiseCancellationEnabled('identity-1')).toBe(true);
  });

  it('enables media encryption by default', () => {
    expect(loadCallMediaEncryptionEnabled('identity-1')).toBe(true);
  });

  it('stores the preference independently for each identity', () => {
    saveCallNoiseCancellationEnabled('identity-1', false);
    saveCallNoiseCancellationEnabled('identity-2', true);

    expect(loadCallNoiseCancellationEnabled('identity-1')).toBe(false);
    expect(loadCallNoiseCancellationEnabled('identity-2')).toBe(true);
  });

  it('preserves both media preferences when either one changes', () => {
    saveCallNoiseCancellationEnabled('identity-1', false);
    saveCallMediaEncryptionEnabled('identity-1', false);

    expect(loadCallNoiseCancellationEnabled('identity-1')).toBe(false);
    expect(loadCallMediaEncryptionEnabled('identity-1')).toBe(false);
  });
});
