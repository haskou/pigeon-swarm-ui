import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { MessageProjector } from '../../../../../contexts/messages/infrastructure/crypto/MessageProjector';

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

function sessionWithConversationKey(
  conversationId: string,
  key: string,
): Session {
  return {
    ...session,
    keychain: {
      conversations: {
        [conversationId]: {
          algorithm: 'aes-256-gcm',
          conversationId,
          createdAt: 1,
          key,
          kind: 'conversation',
          peerIdentityId: 'identity-2',
          version: 2,
        },
      },
      version: 1,
    },
  } as unknown as Session;
}

describe(MessageProjector.name, () => {
  it('projects plain messages without requiring a keychain entry', () => {
    const projector = new MessageProjector(projectorCopy);

    expect(
      projector.project(session, 'conversation-1', {
        authorIdentityId: 'identity-1',
        content: 'hello',
        id: 'message-1',
        timestamp: 10,
      }),
    ).toMatchObject({
      message: { content: 'hello', encrypted: false, mine: true },
      readable: true,
    });
  });

  it('marks a message as mine when its author id is the own id in PEM form', () => {
    const projector = new MessageProjector(projectorCopy);

    expect(
      projector.project(session, 'conversation-1', {
        authorIdentityId:
          '-----BEGIN PUBLIC KEY-----\nidentity-1\n-----END PUBLIC KEY-----\n',
        content: 'hello',
        id: 'message-1',
        timestamp: 10,
      }),
    ).toMatchObject({ message: { mine: true } });
  });

  it('does not mark a message as mine when its author id is rejected', () => {
    const projector = new MessageProjector(projectorCopy);

    expect(
      projector.project(session, 'conversation-1', {
        authorIdentityId: 'x'.repeat(5000),
        content: 'hello',
        id: 'message-1',
        timestamp: 10,
      }),
    ).toMatchObject({ message: { mine: false } });
  });

  it('projects a call event as readable', () => {
    const projector = new MessageProjector(projectorCopy);

    expect(
      projector.project(session, 'conversation-1', {
        authorIdentityId: 'identity-2',
        id: 'call-1',
        timestamp: 15,
        type: 'call_event',
      }),
    ).toMatchObject({ message: { kind: 'call-event' }, readable: true });
  });

  it('reports an unreadable placeholder when the key is missing', () => {
    const projector = new MessageProjector(projectorCopy);

    expect(
      projector.project(session, 'conversation-1', {
        authorIdentityId: 'identity-2',
        encryptedPayload: 'payload',
        id: 'message-2',
        timestamp: 20,
      }),
    ).toMatchObject({
      message: {
        content: projectorCopy.missingKey,
        encrypted: true,
        mine: false,
      },
      readable: false,
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
      projector.project(hydratedSession, conversationId, {
        authorIdentityId: 'identity-2',
        encryptedPayload: 'payload',
        id: 'message-2',
        timestamp: 20,
      }),
    ).toMatchObject({
      message: { content: projectorCopy.decryptFailed, encrypted: true },
      readable: false,
    });
  });

  it('marks encrypted thread messages when projecting without a worker', () => {
    const projector = new MessageProjector(projectorCopy);
    const conversationId = 'thread-conversation';
    const symmetricKey = SymmetricKey.generate();
    const encryptedPayload = symmetricKey
      .encrypt(
        JSON.stringify({
          authorIdentityId: 'identity-2',
          content: 'thread reply',
          timestamp: 30,
          type: 'ThreadMessageSent',
        }),
      )
      .toString();
    const projected = projector.project(
      sessionWithConversationKey(conversationId, symmetricKey.valueOf()),
      conversationId,
      {
        authorIdentityId: 'identity-2',
        encryptedPayload,
        id: 'thread-message',
        replyToMessageId: 'root-message',
        timestamp: 30,
      },
    );

    expect(projected).toMatchObject({
      message: {
        content: 'thread reply',
        encrypted: false,
        replyToMessageId: 'root-message',
        threadRootMessageId: 'root-message',
      },
      readable: true,
    });
  });

  it('does not mark encrypted normal replies as thread messages', () => {
    const projector = new MessageProjector(projectorCopy);
    const conversationId = 'reply-conversation';
    const symmetricKey = SymmetricKey.generate();
    const encryptedPayload = symmetricKey
      .encrypt(
        JSON.stringify({
          authorIdentityId: 'identity-2',
          content: 'normal reply',
          reply: {
            authorIdentityId: 'identity-1',
            content: 'root',
            messageId: 'root-message',
          },
          timestamp: 40,
          type: 'MessageSent',
        }),
      )
      .toString();
    const { message: projected } = projector.project(
      sessionWithConversationKey(conversationId, symmetricKey.valueOf()),
      conversationId,
      {
        authorIdentityId: 'identity-2',
        encryptedPayload,
        id: 'reply-message',
        replyToMessageId: 'root-message',
        timestamp: 40,
      },
    );

    expect(projected).toMatchObject({
      content: 'normal reply',
      encrypted: false,
      replyToMessageId: 'root-message',
    });
    expect(projected.threadRootMessageId).toBeUndefined();
  });
});
