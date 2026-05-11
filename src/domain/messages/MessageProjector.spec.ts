import type { Session } from '../types';

import { MessageProjector } from './MessageProjector';

const projectorCopy = {
  decryptFailed: '[encrypted] decrypt failed',
  missingKey: '[encrypted] missing key',
};

const session = {
  encryptedKeyPair: {},
  identity: {
    encryptedKeyPair: {
      encryptedPrivateKey: 'encrypted',
      publicKey: 'public',
    },
    id: 'identity-1',
    networks: [],
    profile: { name: 'Ada' },
    signature: 'signature',
    timestamp: 1,
    version: 1,
  },
  keychain: {
    conversations: {},
    version: 0,
  },
  password: 'secret',
} as unknown as Session;

describe(MessageProjector.name, () => {
  it('normalizes message envelopes and cursors', () => {
    const projector = new MessageProjector(projectorCopy);

    expect(
      projector.list({
        items: [{ id: 'message-1' }],
        nextBeforeMessageId: 'older-message',
      }),
    ).toEqual({
      messages: [{ id: 'message-1' }],
      nextCursor: 'older-message',
    });
  });

  it('projects plain messages without requiring a keychain entry', async () => {
    const projector = new MessageProjector(projectorCopy);

    await expect(
      projector.toChatMessage(session, 'conversation-1', {
        authorIdentityId: 'identity-1',
        content: 'hello',
        id: 'message-1',
        timestamp: 10,
      }),
    ).resolves.toMatchObject({
      content: 'hello',
      encrypted: false,
      mine: true,
    });
  });

  it('returns a readable encrypted placeholder when the key is missing', async () => {
    const projector = new MessageProjector(projectorCopy);

    await expect(
      projector.toChatMessage(session, 'conversation-1', {
        authorIdentityId: 'identity-2',
        encryptedPayload: 'payload',
        id: 'message-2',
        timestamp: 20,
      }),
    ).resolves.toMatchObject({
      content: projectorCopy.missingKey,
      encrypted: true,
      mine: false,
    });
  });
});
