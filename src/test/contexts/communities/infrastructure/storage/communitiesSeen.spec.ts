import {
  forgetCommunitiesSeen,
  hasSeenCommunities,
  rememberCommunitiesSeen,
} from '../../../../../contexts/communities/infrastructure/storage/communitiesSeen';

describe('communitiesSeen', () => {
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

  afterAll(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('is false before the identity has listed a community on this device', () => {
    expect(hasSeenCommunities('identity-1')).toBe(false);
  });

  it('is kept per identity and stores a flag, no community data', () => {
    rememberCommunitiesSeen('identity-1');

    expect(hasSeenCommunities('identity-1')).toBe(true);
    expect(hasSeenCommunities('identity-2')).toBe(false);
    expect([...storage.values()]).toEqual(['1']);
  });

  it('is forgotten on request', () => {
    rememberCommunitiesSeen('identity-1');
    forgetCommunitiesSeen('identity-1');

    expect(hasSeenCommunities('identity-1')).toBe(false);
  });
});
