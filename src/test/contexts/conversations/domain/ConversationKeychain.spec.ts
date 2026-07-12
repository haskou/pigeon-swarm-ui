import type {
  ConversationKeyEntry,
  LocalKeychain,
} from '../../../../shared/domain/pigeonResources.types';

import { ConversationKeychain } from '../../../../contexts/conversations/domain/ConversationKeychain';

const keychain = {
  conversations: {
    'local-key-id': {
      algorithm: 'aes-256-gcm',
      conversationId: 'local-key-id',
      createdAt: 1,
      key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      kind: 'conversation',
      peerIdentityId: 'identity-2',
      version: 2,
    },
  },
  version: 1,
} satisfies LocalKeychain;

const keychainWithExternalEntryId = {
  conversations: {
    'external-key-id': {
      algorithm: 'aes-256-gcm',
      conversationId: 'community-1',
      createdAt: 1,
      key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      kind: 'community',
      peerIdentityId: '',
      version: 2,
    },
  },
  version: 1,
} satisfies LocalKeychain;

const keychainWithCommunityAndStaleEntrySharingId = {
  conversations: {
    'community-entry-id': {
      algorithm: 'aes-256-gcm',
      conversationId: 'community-1',
      createdAt: 1,
      key: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
      kind: 'community',
      peerIdentityId: '',
      version: 2,
    },
    'stale-entry-id': {
      algorithm: 'aes-256-gcm',
      conversationId: 'community-1',
      createdAt: 1,
      key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      kind: 'conversation',
      peerIdentityId: 'identity-2',
      version: 2,
    },
  },
  version: 1,
} satisfies LocalKeychain;

describe(ConversationKeychain.name, () => {
  it('returns keys by exact conversation id', () => {
    expect(
      ConversationKeychain.entry(keychain, 'identity-1', 'local-key-id'),
    ).toBe(keychain.conversations['local-key-id']);
  });

  it('does not infer legacy conversation ids without an exact key', () => {
    expect(
      ConversationKeychain.entry(
        keychain,
        'identity-1',
        'missing-conversation-id',
      ),
    ).toBeUndefined();
  });

  it('detects exact keychain entries', () => {
    expect(ConversationKeychain.hasEntry(keychain, 'local-key-id')).toBe(true);
    expect(ConversationKeychain.hasEntry(keychain, 'missing-key-id')).toBe(
      false,
    );
  });

  it('adds an entry without mutating the current keychain', () => {
    const entry: ConversationKeyEntry = {
      algorithm: 'aes-256-gcm',
      conversationId: 'conversation-2',
      createdAt: 2,
      key: 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=',
      kind: 'conversation',
      peerIdentityId: 'identity-3',
      version: 2,
    };

    const nextKeychain = ConversationKeychain.withEntry(keychain, entry);

    expect(nextKeychain.conversations['conversation-2']).toBe(entry);
    expect(nextKeychain.version).toBe(2);
    expect(keychain.conversations).not.toHaveProperty('conversation-2');
  });

  it('detects entries by their stored conversation id', () => {
    expect(
      ConversationKeychain.hasEntry(keychainWithExternalEntryId, 'community-1'),
    ).toBe(true);
  });

  it('detects community entries explicitly', () => {
    expect(
      ConversationKeychain.hasCommunityEntry(
        keychainWithExternalEntryId,
        'community-1',
      ),
    ).toBe(true);
  });

  it('removes exact keychain entries without mutating the original keychain', () => {
    const nextKeychain = ConversationKeychain.withoutEntry(
      keychain,
      'local-key-id',
    );

    expect(nextKeychain.conversations).not.toHaveProperty('local-key-id');
    expect(keychain.conversations).toHaveProperty('local-key-id');
  });

  it('removes keychain entries by their stored conversation id', () => {
    const nextKeychain = ConversationKeychain.withoutEntry(
      keychainWithExternalEntryId,
      'community-1',
    );

    expect(nextKeychain.conversations).not.toHaveProperty('external-key-id');
    expect(keychainWithExternalEntryId.conversations).toHaveProperty(
      'external-key-id',
    );
  });

  it('removes all entries matching the community id', () => {
    const nextKeychain = ConversationKeychain.withoutCommunityEntry(
      keychainWithCommunityAndStaleEntrySharingId,
      'community-1',
    );

    expect(nextKeychain.conversations).not.toHaveProperty('community-entry-id');
    expect(nextKeychain.conversations).not.toHaveProperty('stale-entry-id');
  });

  it('returns the same keychain when removing a missing community key', () => {
    expect(
      ConversationKeychain.withoutCommunityEntry(keychain, 'missing-community'),
    ).toBe(keychain);
  });

  it('returns the same keychain when removing a missing entry', () => {
    expect(ConversationKeychain.withoutEntry(keychain, 'missing-key-id')).toBe(
      keychain,
    );
  });
});
