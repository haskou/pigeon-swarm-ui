import { Timestamp } from '@haskou/value-objects';

import { ConversationId } from '../value-objects/ConversationId';
import { ConversationParticipantId } from '../value-objects/ConversationParticipantId';
import { Conversation } from './Conversation';

const conversation = (): Conversation =>
  Conversation.reconstitute(
    ConversationId.fromString('conversation-a'),
    'network-a',
    [
      ConversationParticipantId.fromString('identity-a'),
      ConversationParticipantId.fromString('identity-b'),
    ],
    new Timestamp(100),
    'one-to-one',
  );

describe('Conversation', () => {
  it('resolves the one-to-one peer through participant value objects', () => {
    const peer = conversation().peerIdentity(
      ConversationParticipantId.fromString('identity-a'),
    );

    expect(
      peer?.isEqual(ConversationParticipantId.fromString('identity-b')),
    ).toBe(true);
  });

  it('bumps activity only when the new timestamp is more recent', () => {
    const aggregate = conversation();

    aggregate.bumpActivity(new Timestamp(50));
    expect(aggregate.latestMessageAt().valueOf()).toBe(100);

    aggregate.bumpActivity(new Timestamp(150));
    expect(aggregate.latestMessageAt().valueOf()).toBe(150);
  });
});
