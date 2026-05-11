import type { LocalKeychain } from '../types';

import { ConversationIdFactory } from './ConversationIdFactory';
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

  it('returns keys by deterministic peer conversation id', () => {
    const conversationId = new ConversationIdFactory().create(
      'identity-1',
      'identity-2',
    );

    expect(conversationKeyEntry(keychain, 'identity-1', conversationId)).toBe(
      keychain.conversations['local-key-id'],
    );
  });
});
