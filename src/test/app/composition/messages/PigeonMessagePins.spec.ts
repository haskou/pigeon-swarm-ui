import { mock } from 'jest-mock-extended';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { PinnedMessagesSearcher } from '../../../../contexts/messages/application/list-message-pins/PinnedMessagesSearcher';
import type { MessagePinner } from '../../../../contexts/messages/application/pin-message/MessagePinner';
import type { MessageUnpinner } from '../../../../contexts/messages/application/unpin-message/MessageUnpinner';

import { PigeonMessagePins } from '../../../../app/composition/messages/PigeonMessagePins';
import { ConversationAccessContexts } from '../../../../contexts/conversations/infrastructure/http/ConversationAccessContexts';
import { ConversationId } from '../../../../contexts/conversations/domain/value-objects/ConversationId';
import { IdentityAccessContexts } from '../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { PinnedMessage } from '../../../../contexts/messages/domain/entities/PinnedMessage';
import { MessageMapper } from '../../../../contexts/messages/infrastructure/http/MessageMapper';

const session = { identity: { id: 'reader-a' } } as Session;
const oneToOne: ConversationResource = {
  adminIds: [],
  id: 'one-to-one:a',
  networkId: 'network-a',
  participantIds: ['reader-a', 'friend-a'],
  type: 'one-to-one',
  unreadCount: 0,
};

describe(PigeonMessagePins.name, () => {
  it('keeps the author and timestamp returned by the pins endpoint', async () => {
    const searcher = mock<PinnedMessagesSearcher>();
    const pins = new PigeonMessagePins(
      new IdentityAccessContexts(),
      new ConversationAccessContexts(),
      new MessageMapper(),
      searcher,
      mock<MessagePinner>(),
      mock<MessageUnpinner>(),
    );

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

  it('opens the conversation and hands its type to the pin use cases', async () => {
    const conversationContexts = new ConversationAccessContexts();
    const pinner = mock<MessagePinner>();
    const unpinner = mock<MessageUnpinner>();
    const pins = new PigeonMessagePins(
      new IdentityAccessContexts(),
      conversationContexts,
      new MessageMapper(),
      mock<PinnedMessagesSearcher>(),
      pinner,
      unpinner,
    );

    await pins.pin(session, oneToOne, 'message-a');
    await pins.unpin(session, oneToOne, 'message-a');

    const [pinned] = pinner.pin.mock.calls[0] ?? [];
    const [unpinned] = unpinner.unpin.mock.calls[0] ?? [];

    expect(
      conversationContexts.findOpen(ConversationId.fromString('one-to-one:a')),
    ).toBe(oneToOne);
    expect(pinned?.getConversationType().isOneToOne()).toBe(true);
    expect(pinned?.getMessageId().toString()).toBe('message-a');
    expect(unpinned?.getConversationType().isOneToOne()).toBe(true);
  });
});
