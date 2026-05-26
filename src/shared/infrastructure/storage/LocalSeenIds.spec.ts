import { LocalSeenIds } from './LocalSeenIds';

describe(LocalSeenIds.name, () => {
  beforeEach(() => {
    const values = new Map<string, string>();

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        clear: jest.fn(() => values.clear()),
        getItem: jest.fn((key: string) => values.get(key) ?? null),
        key: jest.fn(
          (index: number) => Array.from(values.keys())[index] ?? null,
        ),
        get length() {
          return values.size;
        },
        removeItem: jest.fn((key: string) => values.delete(key)),
        setItem: jest.fn((key: string, value: string) =>
          values.set(key, value),
        ),
      } as Storage,
    });
  });

  it('stores unique seen ids per owner', () => {
    const seenIds = new LocalSeenIds('pigeon-swarm:test-seen-ids');

    expect(seenIds.markSeen('identity-1', ['one', 'two', 'one'])).toEqual([
      'one',
      'two',
    ]);
    expect(seenIds.markSeen('identity-1', ['two', 'three'])).toEqual([
      'one',
      'two',
      'three',
    ]);
    expect(seenIds.get('identity-2')).toEqual([]);
  });

  it('ignores invalid stored values and blank ids', () => {
    const seenIds = new LocalSeenIds('pigeon-swarm:test-seen-ids');

    globalThis.localStorage.setItem(
      'pigeon-swarm:test-seen-ids:identity-1',
      JSON.stringify({ ids: ['one', '', 7, 'two'] }),
    );

    expect(seenIds.get('identity-1')).toEqual(['one', 'two']);
  });
});
