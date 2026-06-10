import type { LocalKeychain } from '../../../shared/domain/pigeonResources.types';

import { ConversationKeychain } from './ConversationKeychain';

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
});
