import { ContactPinStore } from '../../../../../contexts/identities/infrastructure/storage/ContactPinStore';

const storageKey = 'pigeon-swarm:contact-pins:v1:local-1';

describe('ContactPinStore', () => {
  const storage = new Map<string, string>();
  let refuseWrites = false;

  beforeEach(() => {
    storage.clear();
    refuseWrites = false;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => {
          if (refuseWrites) throw new Error('QuotaExceededError');

          storage.set(key, value);
        },
      },
    });
  });

  it('keeps verifications separate for each local identity on this device', () => {
    const store = new ContactPinStore();

    store.verify('local-1', 'identity-x', 'bob', '2026-05-01T00:00:00.000Z');

    expect(store.load('local-1')).toEqual({
      'identity-x': { handle: 'bob', verifiedAt: '2026-05-01T00:00:00.000Z' },
    });
    expect(store.load('local-2')).toEqual({});
  });

  it('treats unreadable data as no remembered contacts', () => {
    storage.set(storageKey, '{not json');

    expect(new ContactPinStore().load('local-1')).toEqual({});
  });

  it('drops malformed entries instead of trusting them', () => {
    storage.set(
      storageKey,
      JSON.stringify({
        'identity-x': { handle: 'bob', verifiedAt: 42 },
        'identity-y': 'not-an-object',
        'identity-z': { verifiedAt: '2026-05-01T00:00:00.000Z' },
      }),
    );

    expect(new ContactPinStore().load('local-1')).toEqual({
      'identity-x': { handle: 'bob' },
      'identity-z': { verifiedAt: '2026-05-01T00:00:00.000Z' },
    });
  });

  it('does not fail a conversation when remembering a contact cannot be saved', () => {
    refuseWrites = true;
    const store = new ContactPinStore();

    expect(() => store.remember('local-1', 'identity-x', 'bob')).not.toThrow();
    expect(store.load('local-1')).toEqual({});
  });

  it('reports a verification that could not be saved', () => {
    refuseWrites = true;
    const store = new ContactPinStore();

    expect(() => store.verify('local-1', 'identity-x', 'bob')).toThrow(
      'QuotaExceededError',
    );
    expect(store.load('local-1')).toEqual({});
  });
});
