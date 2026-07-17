import type { Session } from '../../../shared/domain/pigeonResources.types';

import { Conversation } from '../../../contexts/conversations/domain/Conversation';

export function conversationFixture(
  overrides: Partial<ReturnType<Conversation['toPrimitives']>> = {},
): Conversation {
  const type = overrides.type ?? 'one-to-one';

  return Conversation.fromPrimitives({
    id: type === 'group' ? 'group:a' : 'one-to-one:a',
    latestMessageAt: 100,
    latestMessagePreview: 'hello',
    name: type === 'group' ? 'Friends' : undefined,
    networkId: 'network-a',
    participantIds: ['identity-a', 'identity-b'],
    peerIdentityId: undefined,
    type,
    unreadCount: 1,
    ...overrides,
  });
}

export function sessionFixture(): Session {
  return {
    identity: { id: 'identity-a' },
    keychain: { conversations: {}, version: 1 },
    keychainExternalIdentifier: 'keychain-a',
  } as Session;
}
