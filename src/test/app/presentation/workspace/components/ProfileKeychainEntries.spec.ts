import { describe, expect, it } from '@jest/globals';

import type {
  Community,
  ConversationResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { ProfileKeychainEntries } from '../../../../../app/presentation/workspace/components/ProfileKeychainEntries';

describe(ProfileKeychainEntries.name, () => {
  it('presents identity, community, and conversation keys with readable names', () => {
    const session = {
      identity: {
        encryptedKeyPair: { encryptedPrivateKey: 'private-key' },
        encryptedMasterKey: 'master-key',
        id: 'current',
        profile: { name: 'Current user' },
      },
      keychain: {
        conversations: {
          community: {
            algorithm: 'aes-256-gcm',
            conversationId: 'community',
            key: 'community-key',
            kind: 'community',
          },
          conversation: {
            algorithm: 'aes-256-gcm',
            conversationId: 'conversation',
            key: 'conversation-key',
            kind: 'one-to-one',
            peerIdentityId: 'peer',
          },
        },
      },
    } as unknown as Session;

    const entries = ProfileKeychainEntries.from({
      communities: [
        {
          id: 'community',
          name: 'Open source community',
        } as Community,
      ],
      conversations: [
        {
          id: 'conversation',
          name: 'Architecture chat',
        } as ConversationResource,
      ],
      identityNames: { current: 'Current user', peer: 'Peer user' },
      identityProfiles: {},
      session,
    });

    expect(entries.map((entry) => entry.key)).toEqual([
      'master-key',
      'private-key',
      'community-key',
      'conversation-key',
    ]);
    expect(entries[2]?.title).toContain('Open source community');
    expect(entries[3]?.title).toContain('Architecture chat');
    expect(entries.slice(2).every((entry) => entry.sensitive)).toBe(true);
  });
});
