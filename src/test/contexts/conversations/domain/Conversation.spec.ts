import { Timestamp } from '@haskou/value-objects';

import { Conversation } from '../../../../contexts/conversations/domain/Conversation';
import { DirectConversationInvitationNotAllowedError } from '../../../../contexts/conversations/domain/errors/DirectConversationInvitationNotAllowedError';
import { ConversationParticipantId } from '../../../../contexts/conversations/domain/value-objects/ConversationParticipantId';
import { ConversationPreview } from '../../../../contexts/conversations/domain/value-objects/ConversationPreview';

function conversation(
  latestMessageAt = 100,
  type: 'group' | 'one-to-one' = 'one-to-one',
  unreadCount = 2,
): Conversation {
  return Conversation.fromPrimitives({
    id: type === 'group' ? 'group:a' : 'one-to-one:a',
    latestMessageAt,
    latestMessagePreview: 'hello',
    name: type === 'group' ? 'Friends' : undefined,
    networkId: 'network-a',
    participantIds: ['identity-a', 'identity-b'],
    peerIdentityId: undefined,
    type,
    unreadCount,
  });
}

describe(Conversation.name, () => {
  it('resolves a direct peer without leaking participant primitives', () => {
    const peer = conversation().peerOf(
      ConversationParticipantId.fromString('identity-a'),
    );

    expect(
      peer?.isEqual(ConversationParticipantId.fromString('identity-b')),
    ).toBe(true);
  });

  it('records only newer activity', () => {
    const aggregate = conversation();

    aggregate.recordActivity(
      new Timestamp(50),
      ConversationPreview.fromOptional('old'),
    );
    expect(aggregate.isMoreRecentThan(conversation(110))).toBe(false);

    aggregate.recordActivity(
      new Timestamp(150),
      ConversationPreview.fromOptional('new'),
    );
    expect(aggregate.isMoreRecentThan(conversation(110))).toBe(true);
    expect(aggregate.pullDomainEvents()).toHaveLength(1);
  });

  it('invites a participant to a group and records the mutation', () => {
    const aggregate = conversation(100, 'group');

    aggregate.invite(
      ConversationParticipantId.fromString('identity-c'),
      new Timestamp(200),
    );

    expect(aggregate.pullDomainEvents()).toEqual([
      {
        aggregateId: 'group:a',
        occurredAt: 200,
        type: 'ConversationParticipantInvited',
      },
    ]);
  });

  it('rejects invitations to direct conversations', () => {
    expect(() =>
      conversation().invite(
        ConversationParticipantId.fromString('identity-c'),
        new Timestamp(200),
      ),
    ).toThrow(DirectConversationInvitationNotAllowedError);
  });

  it('records when the conversation is marked as read', () => {
    const aggregate = conversation();

    aggregate.markRead(new Timestamp(200));

    expect(aggregate.pullDomainEvents()[0]).toEqual({
      aggregateId: 'one-to-one:a',
      occurredAt: 200,
      type: 'ConversationRead',
    });
  });

  it('does not record a read mutation when it was already read', () => {
    const aggregate = conversation(100, 'one-to-one', 0);

    aggregate.markRead(new Timestamp(200));

    expect(aggregate.pullDomainEvents()).toHaveLength(0);
  });
});
