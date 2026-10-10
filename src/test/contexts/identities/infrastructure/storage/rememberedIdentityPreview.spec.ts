import {
  clearRememberedIdentityPreview,
  loadRememberedIdentityPreview,
  saveRememberedIdentityPreview,
} from '../../../../../contexts/identities/infrastructure/storage/rememberedIdentityPreview';

describe('rememberedIdentityPreview', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
  });

  it('no longer loads the preview once it is cleared', () => {
    saveRememberedIdentityPreview({ identityId: 'identity-a', name: 'Ada' });

    expect(loadRememberedIdentityPreview('identity-a')).toEqual({
      identityId: 'identity-a',
      name: 'Ada',
      pictureUrl: null,
    });

    clearRememberedIdentityPreview();

    expect(loadRememberedIdentityPreview('identity-a')).toBeNull();
  });
});
