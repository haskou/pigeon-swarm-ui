import type { ChatMessage } from '../../../../../contexts/messages/presentation/view-models/ChatMessage';

import { Message } from '../../../../../contexts/messages/domain/Message';
import { MessageMapper } from '../../../../../contexts/messages/infrastructure/http/MessageMapper';

function projection(): ChatMessage {
  return {
    attachments: [],
    authorIdentityId: 'author-a',
    content: 'Hello',
    encrypted: true,
    id: 'message-a',
    mine: true,
    raw: {
      authorIdentityId: 'author-a',
      conversationId: 'conversation-a',
      createdAt: 100,
      id: 'message-a',
      type: 'sent',
    },
    reactions: [],
    timestamp: 100,
  };
}

describe(MessageMapper.name, () => {
  it('round-trips an HTTP projection through the aggregate', () => {
    const mapper = new MessageMapper();
    const readModel = projection();

    expect(
      mapper.toChatMessage(mapper.fromChatMessage('conversation-a', readModel)),
    ).toEqual(readModel);
  });

  it('creates a safe projection when no source read model exists', () => {
    const mapper = new MessageMapper();
    const aggregate = mapper.fromChatMessage('conversation-a', projection());
    const hydrated = aggregate.toPrimitives();

    expect(
      mapper.toChatMessage(Message.fromPrimitives(hydrated)),
    ).toMatchObject({ content: 'Hello', id: 'message-a' });
  });

  it('hydrates pin state from the source projection', () => {
    const mapper = new MessageMapper();
    const readModel = projection();

    readModel.raw.pinnedByIdentityId = 'moderator-a';

    expect(
      mapper.fromChatMessage('conversation-a', readModel).toPrimitives().pinned,
    ).toBe(true);
  });
});
