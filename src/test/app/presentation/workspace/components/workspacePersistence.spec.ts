import {
  draftsStorageKey,
  encryptedDraftsStorageValue,
  loadEncryptedDraftPayloads,
} from '../../../../../app/presentation/workspace/components/workspacePersistence';

describe('workspacePersistence draft storage', () => {
  const storage = new Map<string, string>();

  beforeAll(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      },
    });
  });

  beforeEach(() => {
    storage.clear();
  });

  it('ignores plaintext draft maps', () => {
    storage.set(
      draftsStorageKey('identity-1'),
      JSON.stringify({ conversationId: 'plain draft' }),
    );

    expect(loadEncryptedDraftPayloads('identity-1')).toEqual({});
  });

  it('loads encrypted draft envelopes without exposing plaintext', () => {
    storage.set(
      draftsStorageKey('identity-1'),
      JSON.stringify(
        encryptedDraftsStorageValue({
          conversationId: 'encrypted-draft',
        }),
      ),
    );

    expect(loadEncryptedDraftPayloads('identity-1')).toEqual({
      conversationId: 'encrypted-draft',
    });
    expect(storage.get(draftsStorageKey('identity-1'))).not.toContain(
      'plain draft',
    );
  });
});
