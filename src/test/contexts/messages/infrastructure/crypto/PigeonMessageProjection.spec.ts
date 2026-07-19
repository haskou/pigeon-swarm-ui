import { describe, expect, it } from '@jest/globals';

import type { MessageResource } from '../../../../../shared/domain/pigeonResources.types';

import { MessageProjector } from '../../../../../contexts/messages/infrastructure/crypto/MessageProjector';
import { PigeonMessageProjection } from '../../../../../contexts/messages/infrastructure/crypto/PigeonMessageProjection';
import { sessionFixture } from '../../../conversations/ConversationFixture';

const projectionCopy = {
  decryptFailed: 'decrypt failed',
  missingKey: 'missing key',
};

describe(PigeonMessageProjection.name, () => {
  it('projects messages in source order and excludes deleted resources', async () => {
    const projection = new PigeonMessageProjection(
      new MessageProjector(projectionCopy),
      projectionCopy,
    );
    const messages: MessageResource[] = [
      ...Array.from({ length: 10 }, (_, index) => ({
        authorIdentityId: 'identity-b',
        content: `message-${index}`,
        createdAt: index,
        id: `message-${index}`,
        type: 'sent' as const,
      })),
      {
        authorIdentityId: 'identity-b',
        createdAt: 11,
        id: 'deleted-message',
        type: 'deleted',
      },
    ];

    const projected = await projection.decryptMany(
      sessionFixture(),
      'conversation-a',
      messages,
    );

    expect(projected.map((message) => message.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `message-${index}`),
    );
  });

  it('projects a single message through the same pipeline', async () => {
    const projection = new PigeonMessageProjection(
      new MessageProjector(projectionCopy),
      projectionCopy,
    );

    const projected = await projection.decrypt(
      sessionFixture(),
      'conversation-a',
      {
        authorIdentityId: 'identity-b',
        content: 'hello',
        createdAt: 1,
        id: 'message-a',
        type: 'sent',
      },
    );

    expect(projected).toMatchObject({ content: 'hello', id: 'message-a' });
  });
});
