import { describe, expect, it } from '@jest/globals';

import type { CommunityResource as Community } from '../../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

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
      'community-key',
      'conversation-key',
    ]);
    expect(entries[0]?.title).toContain('Open source community');
    expect(entries[1]?.title).toContain('Architecture chat');
    expect(entries.every((entry) => entry.sensitive)).toBe(true);
  });
});
