import type { LocalKeychain } from '../types';

import { conversationKeyEntry } from './conversationKey';

const keychain = {
  conversations: {
    'local-key-id': {
      conversationId: 'local-key-id',
      createdAt: 1,
      peerIdentityId: 'identity-2',
      privateKey: 'private',
      publicKey: 'public',
    },
  },
  version: 1,
} satisfies LocalKeychain;

describe(conversationKeyEntry.name, () => {
  it('returns keys by exact conversation id', () => {
    expect(conversationKeyEntry(keychain, 'identity-1', 'local-key-id')).toBe(
      keychain.conversations['local-key-id'],
    );
  });

  it('does not infer legacy conversation ids without an exact key', () => {
    expect(
      conversationKeyEntry(keychain, 'identity-1', 'missing-conversation-id'),
    ).toBeUndefined();
  });
});
