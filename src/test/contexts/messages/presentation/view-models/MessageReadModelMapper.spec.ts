import { describe, expect, it } from '@jest/globals';

import type { ChatMessage } from '../../../../../contexts/messages/domain/ChatMessage';

import { MessageReadModelMapper } from '../../../../../contexts/messages/presentation/view-models/MessageReadModelMapper';

const message = (deliveryStatus: ChatMessage['deliveryStatus']): ChatMessage =>
  ({
    attachments: [],
    authorIdentityId: 'alice',
    content: 'hello',
    deliveryStatus,
    encrypted: false,
    id: 'message-1',
    mine: true,
    raw: { conversationId: 'group-1', id: 'message-1', type: 'sent' },
    reactions: [],
    timestamp: 100,
  }) as unknown as ChatMessage;

describe(MessageReadModelMapper.name, () => {
  it.each([
    ['held', 'pending'],
    ['retry', 'pending'],
    ['pending', 'pending'],
    ['failed', 'failed'],
    [undefined, 'delivered'],
  ] as const)(
    'maps a %s send to the %s delivery state',
    (deliveryStatus, expected) => {
      expect(
        MessageReadModelMapper.toAggregate(
          message(deliveryStatus),
        ).toPrimitives().deliveryState,
      ).toBe(expected);
    },
  );
});
