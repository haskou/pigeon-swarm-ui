import { mock } from 'jest-mock-extended';

import type { PinnedMessagesSearcher } from '../../../../contexts/messages/application/list-message-pins/PinnedMessagesSearcher';
import type { MessagePinner } from '../../../../contexts/messages/application/pin-message/MessagePinner';
import type { MessageUnpinner } from '../../../../contexts/messages/application/unpin-message/MessageUnpinner';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { PigeonMessagePins } from '../../../../app/composition/messages/PigeonMessagePins';
import { IdentityAccessContexts } from '../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { PinnedMessage } from '../../../../contexts/messages/domain/entities/PinnedMessage';
import { MessageMapper } from '../../../../contexts/messages/infrastructure/http/MessageMapper';

describe(PigeonMessagePins.name, () => {
  it('keeps the author and timestamp returned by the pins endpoint', async () => {
    const searcher = mock<PinnedMessagesSearcher>();
    const pins = new PigeonMessagePins(
      new IdentityAccessContexts(),
      new MessageMapper(),
      searcher,
      mock<MessagePinner>(),
      mock<MessageUnpinner>(),
    );
    const session = { identity: { id: 'reader-a' } } as Session;

    searcher.search.mockResolvedValue([
      PinnedMessage.fromPrimitives({
        createdAt: 50,
        message: {
          authorId: 'author-a',
          content: 'Pinned',
          conversationId: 'conversation-a',
          createdAt: 40,
          deleted: false,
          deliveryState: 'delivered',
          encrypted: false,
          id: 'message-a',
          kind: 'message',
          pinned: true,
          reactions: [],
        },
        messageId: 'message-a',
        pinnedByIdentityId: 'moderator-a',
      }),
    ]);

    const [pin] = await pins.list(session, 'conversation-a');

    expect(pin).toMatchObject({
      createdAt: 50,
      messageId: 'message-a',
      pinnedByIdentityId: 'moderator-a',
    });
  });
});
