import { createHash } from 'crypto';

import type { ConversationKeyEntry } from '../../../../../contexts/identities/infrastructure/keychain/ConversationKeyEntry';
import type {
  ConversationResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { ConversationIdFactory } from '../../../../../contexts/conversations/domain/ConversationIdFactory';
import { ConversationKeychainRecovery } from '../../../../../contexts/identities/infrastructure/keychain/ConversationKeychainRecovery';

const canonicalId = `one-to-one:${createHash('sha256').update('identity-B:identity-a:network-1').digest('hex')}`;
const legacyId = `one-to-one:${createHash('sha256').update('identity-a:identity-B:network-1').digest('hex')}`;
const entry: ConversationKeyEntry = {
  algorithm: 'aes-256-gcm',
  conversationId: legacyId,
  createdAt: 1,
  key: 'retained-key',
  kind: 'conversation',
  peerIdentityId: 'identity-B',
  version: 2,
};
const conversation: ConversationResource = {
  id: canonicalId,
  networkId: 'network-1',
  peerIdentityId: 'identity-B',
  type: 'one-to-one',
};
const recovery = new ConversationKeychainRecovery(new ConversationIdFactory());

function session(key: ConversationKeyEntry): Session {
  return {
    identity: { id: 'identity-a' },
    keychain: { conversations: { [legacyId]: key }, version: 3 },
  } as unknown as Session;
}

describe(ConversationKeychainRecovery.name, () => {
  it.each([
    { ...conversation, networkId: 'network-2' },
    { ...conversation, peerIdentityId: 'identity-c' },
    { ...conversation, id: 'one-to-one:unrelated' },
    { ...conversation, type: 'group' as const },
  ])(
    'does not associate a legacy key with a different conversation scope %#',
    (resource) => {
      const current = session(entry);

      expect(recovery.recover(current, [resource])).toBe(current);
    },
  );

  it.each([
    { ...entry, peerIdentityId: 'identity-c' },
    { ...entry, conversationId: 'unrelated' },
    { ...entry, kind: 'community' as const },
  ])('does not reuse an entry with mismatching metadata %#', (key) => {
    const current = session(key);

    expect(recovery.recover(current, [conversation])).toBe(current);
  });

  it('preserves an existing canonical key instead of replacing it with a legacy entry', () => {
    const current = session(entry);
    current.keychain.conversations[canonicalId] = {
      ...entry,
      conversationId: canonicalId,
      key: 'canonical-key',
    };

    expect(recovery.recover(current, [conversation])).toBe(current);
    expect(current.keychain.conversations[canonicalId].key).toBe(
      'canonical-key',
    );
  });
});
