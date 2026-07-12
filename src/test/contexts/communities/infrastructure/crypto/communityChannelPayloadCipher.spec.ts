import { EncryptedPayload, SymmetricKey } from '@haskou/value-objects';

import type { ConversationKeyEntry } from '../../../../../shared/domain/pigeonResources.types';

import { encryptCommunityChannelPayload } from '../../../../../contexts/communities/infrastructure/crypto/communityChannelPayloadCipher';

describe('communityChannelPayloadCipher', () => {
  it('does not expose recipient identifiers in channel message envelopes', () => {
    const communityId = 'community-1';
    const symmetricKey = SymmetricKey.generate();
    const communityKey: ConversationKeyEntry = {
      algorithm: 'aes-256-gcm',
      conversationId: communityId,
      createdAt: 1,
      key: symmetricKey.valueOf(),
      kind: 'community',
      peerIdentityId: communityId,
      version: 2,
    };
    const encryptedPayload = encryptCommunityChannelPayload({
      attachments: [],
      authorIdentityId: 'identity-1',
      channelId: 'channel-1',
      communityId,
      communityKey,
      content: 'hello community',
      timestamp: 1234,
    });
    expect(encryptedPayload).not.toContain('hello community');
    expect(encryptedPayload).not.toContain('recipients');
    expect(encryptedPayload).not.toContain('wrappedKey');

    const payload = JSON.parse(
      symmetricKey.decrypt(new EncryptedPayload(encryptedPayload)).toString(),
    ) as {
      content?: string;
      recipients?: Record<string, string>;
      type?: string;
      wrappedKey?: string;
    };

    expect(payload.content).toBe('hello community');
    expect(payload.type).toBe('CommunityChannelMessageSent');
    expect(payload).not.toHaveProperty('recipients');
    expect(payload).not.toHaveProperty('wrappedKey');
  });

  it('requires a community key before encrypting channel messages', () => {
    expect(() =>
      encryptCommunityChannelPayload({
        attachments: [],
        authorIdentityId: 'identity-1',
        channelId: 'channel-1',
        communityId: 'community-1',
        content: 'hello community',
        timestamp: 1234,
      }),
    ).toThrow('Community key is required');
  });

  it('marks edited channel message payloads with the edition event type', () => {
    const communityId = 'community-1';
    const symmetricKey = SymmetricKey.generate();
    const communityKey: ConversationKeyEntry = {
      algorithm: 'aes-256-gcm',
      conversationId: communityId,
      createdAt: 1,
      key: symmetricKey.valueOf(),
      kind: 'community',
      peerIdentityId: communityId,
      version: 2,
    };
    const encryptedPayload = encryptCommunityChannelPayload({
      attachments: [],
      authorIdentityId: 'identity-1',
      channelId: 'channel-1',
      communityId,
      communityKey,
      content: 'edited text',
      eventType: 'CommunityChannelMessageEdited',
      timestamp: 5678,
    });
    const payload = JSON.parse(
      symmetricKey.decrypt(new EncryptedPayload(encryptedPayload)).toString(),
    ) as {
      content?: string;
      timestamp?: number;
      type?: string;
    };

    expect(payload.content).toBe('edited text');
    expect(payload.timestamp).toBe(5678);
    expect(payload.type).toBe('CommunityChannelMessageEdited');
  });
});
