import { KeyPair } from '@haskou/value-objects';

import type { ConversationKeyEntry } from '../types';

import { encryptCommunityChannelPayload } from './communityChannelPayloadCipher';

describe('communityChannelPayloadCipher', () => {
  it('does not expose recipient identifiers in channel message envelopes', async () => {
    const communityId = 'community-1';
    const communityKeyPair = await KeyPair.generate();
    const communityKeyPairPrimitives = communityKeyPair.toPrimitives();
    const communityKey: ConversationKeyEntry = {
      conversationId: communityId,
      createdAt: 1,
      peerIdentityId: communityId,
      privateKey: communityKeyPairPrimitives.privateKey,
      publicKey: communityKeyPairPrimitives.publicKey,
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
    const payload = JSON.parse(encryptedPayload) as {
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
});
