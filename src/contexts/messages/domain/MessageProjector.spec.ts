import type { Session } from '../../../shared/domain/pigeonResources.types';

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

  it('projects plain messages without requiring a keychain entry', () => {
    const projector = new MessageProjector(projectorCopy);

    expect(
      projector.toChatMessage(session, 'conversation-1', {
        authorIdentityId: 'identity-1',
        content: 'hello',
        id: 'message-1',
        timestamp: 10,
      }),
    ).toMatchObject({
      content: 'hello',
      encrypted: false,
      mine: true,
    });
  });

  it('returns a readable encrypted placeholder when the key is missing', () => {
    const projector = new MessageProjector(projectorCopy);

    expect(
      projector.toChatMessage(session, 'conversation-1', {
        authorIdentityId: 'identity-2',
        encryptedPayload: 'payload',
        id: 'message-2',
        timestamp: 20,
      }),
    ).toMatchObject({
      content: projectorCopy.missingKey,
      encrypted: true,
      mine: false,
    });
  });

  it('uses exact conversation keys for encrypted messages', () => {
    const projector = new MessageProjector(projectorCopy);
    const conversationId = 'local-key-id';
    const hydratedSession = {
      ...session,
      keychain: {
        conversations: {
          'local-key-id': {
            algorithm: 'aes-256-gcm',
            conversationId: 'local-key-id',
            createdAt: 1,
            key: 'invalid-symmetric-key',
            kind: 'conversation',
            peerIdentityId: 'identity-2',
            version: 2,
          },
        },
        version: 1,
      },
    } as unknown as Session;

    expect(
      projector.toChatMessage(hydratedSession, conversationId, {
        authorIdentityId: 'identity-2',
        encryptedPayload: 'payload',
        id: 'message-2',
        timestamp: 20,
      }),
    ).toMatchObject({
      content: projectorCopy.decryptFailed,
      encrypted: true,
    });
  });
});
