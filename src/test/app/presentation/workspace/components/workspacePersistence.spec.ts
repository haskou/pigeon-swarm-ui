import {
  draftsStorageKey,
  encryptedDraftsStorageValue,
  loadEncryptedDraftPayloads,
  loadLegacyPlainDrafts,
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

  it('loads legacy plaintext drafts so they can be migrated', () => {
    storage.set(
      draftsStorageKey('identity-1'),
      JSON.stringify({ conversationId: 'plain draft' }),
    );

    expect(loadLegacyPlainDrafts('identity-1')).toEqual({
      conversationId: 'plain draft',
    });
    expect(loadEncryptedDraftPayloads('identity-1')).toEqual({});
  });

  it('keeps encrypted draft envelopes separate from legacy plaintext', () => {
    storage.set(
      draftsStorageKey('identity-1'),
      JSON.stringify(
        encryptedDraftsStorageValue({
          conversationId: 'encrypted-draft',
        }),
      ),
    );

    expect(loadLegacyPlainDrafts('identity-1')).toEqual({});
    expect(loadEncryptedDraftPayloads('identity-1')).toEqual({
      conversationId: 'encrypted-draft',
    });
    expect(storage.get(draftsStorageKey('identity-1'))).not.toContain(
      'plain draft',
    );
  });
});
