import type {
  ConversationResource,
  LocalKeychain,
} from '../../../shared/domain/pigeonResources.types';

import { ConversationPeer } from './ConversationPeer';

describe(ConversationPeer.name, () => {
  it('returns the participant that is not the current identity', () => {
    expect(
      ConversationPeer.identityId(
        {
          id: 'conversation-1',
          participantIds: ['identity-1', 'identity-2'],
        } as ConversationResource,
        'identity-1',
      ),
    ).toBe('identity-2');
  });

  it('falls back to the local keychain peer', () => {
    const keychain = {
      conversations: {
        'conversation-1': {
          algorithm: 'aes-256-gcm',
          conversationId: 'conversation-1',
          createdAt: 1,
          key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          kind: 'conversation',
          peerIdentityId: 'identity-2',
          version: 2,
        },
      },
      version: 1,
    } satisfies LocalKeychain;

    expect(
      ConversationPeer.identityId(
        { id: 'conversation-1' } as ConversationResource,
        'identity-1',
        keychain,
      ),
    ).toBe('identity-2');
  });

  it('does not resolve a group participant as a one-to-one peer', () => {
    expect(
      ConversationPeer.identityId(
        {
          id: 'group:conversation-1',
          participantIds: ['identity-1', 'identity-2', 'identity-3'],
          type: 'group',
        } as ConversationResource,
        'identity-1',
      ),
    ).toBeUndefined();
  });
});
