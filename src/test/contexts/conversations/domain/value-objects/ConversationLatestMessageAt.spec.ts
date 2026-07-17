import { Timestamp } from '@haskou/value-objects';

import { ConversationLatestMessageAt } from '../../../../../contexts/conversations/domain/value-objects/ConversationLatestMessageAt';

describe(ConversationLatestMessageAt.name, () => {
  it('preserves absence until activity is recorded', () => {
    const latestMessageAt = ConversationLatestMessageAt.empty();

    expect(latestMessageAt.toPrimitives()).toBeUndefined();
    expect(latestMessageAt.record(new Timestamp(100))).toBe(true);
    expect(latestMessageAt.toPrimitives()).toBe(100);
  });

  it('rejects activity older than the current timestamp', () => {
    const latestMessageAt = ConversationLatestMessageAt.fromOptional(100);

    expect(latestMessageAt.record(new Timestamp(90))).toBe(false);
    expect(latestMessageAt.toPrimitives()).toBe(100);
  });
});
