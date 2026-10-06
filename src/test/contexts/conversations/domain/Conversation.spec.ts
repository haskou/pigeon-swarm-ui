import { Timestamp } from '@haskou/value-objects';

import { Conversation } from '../../../../contexts/conversations/domain/Conversation';
import { ConversationRosterChangeNotAllowedError } from '../../../../contexts/conversations/domain/errors/ConversationRosterChangeNotAllowedError';
import { DirectConversationInvitationNotAllowedError } from '../../../../contexts/conversations/domain/errors/DirectConversationInvitationNotAllowedError';
import { ConversationParticipantId } from '../../../../contexts/conversations/domain/value-objects/ConversationParticipantId';

function conversation(
  latestMessageAt = 100,
  type: 'group' | 'one-to-one' = 'one-to-one',
  unreadCount = 2,
  roster: { adminIds?: string[]; participantIds?: string[] } = {},
): Conversation {
  return Conversation.fromPrimitives({
    adminIds: roster.adminIds ?? [],
    creatorId: 'identity-a',
    id: type === 'group' ? 'group:a' : 'one-to-one:a',
    latestMessageAt,
    name: type === 'group' ? 'Friends' : undefined,
    networkId: 'network-a',
    participantIds: roster.participantIds ?? ['identity-a', 'identity-b'],
    type,
    unreadCount,
  });
}

const member = ConversationParticipantId.fromString;

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

    aggregate.recordActivity(new Timestamp(50));
    expect(aggregate.isMoreRecentThan(conversation(110))).toBe(false);

    aggregate.recordActivity(new Timestamp(150));
    expect(aggregate.isMoreRecentThan(conversation(110))).toBe(true);
    expect(aggregate.pullDomainEvents()).toHaveLength(1);
  });

  it('invites a participant to a group and records the mutation', () => {
    const aggregate = conversation(100, 'group');

    aggregate.invite(
      member('identity-c'),
      member('identity-a'),
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
        member('identity-c'),
        member('identity-a'),
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

  describe('roster', () => {
    const roster = {
      adminIds: ['identity-b'],
      participantIds: ['identity-a', 'identity-b', 'identity-c', 'identity-d'],
    };

    it('lets the creator and admins invite but not plain members', () => {
      const group = conversation(100, 'group', 0, roster);

      expect(group.canInvite(member('identity-a'))).toBe(true);
      expect(group.canInvite(member('identity-b'))).toBe(true);
      expect(group.canInvite(member('identity-c'))).toBe(false);
    });

    it('rejects an invitation from a plain member', () => {
      expect(() =>
        conversation(100, 'group', 0, roster).invite(
          member('identity-e'),
          member('identity-c'),
          new Timestamp(200),
        ),
      ).toThrow(ConversationRosterChangeNotAllowedError);
    });

    it('keeps admins and the creator out of admin removal by admins', () => {
      const group = conversation(100, 'group', 0, roster);

      expect(group.canRemove(member('identity-c'), member('identity-b'))).toBe(
        true,
      );
      expect(group.canRemove(member('identity-a'), member('identity-b'))).toBe(
        false,
      );
      expect(group.canRemove(member('identity-b'), member('identity-a'))).toBe(
        true,
      );
      expect(group.canRemove(member('identity-b'), member('identity-b'))).toBe(
        false,
      );
      expect(group.canRemove(member('identity-d'), member('identity-c'))).toBe(
        false,
      );
    });

    it('removes a participant and its admin role', () => {
      const group = conversation(100, 'group', 0, roster);

      group.removeParticipant(
        member('identity-b'),
        member('identity-a'),
        new Timestamp(200),
      );

      expect(group.toPrimitives()).toEqual(
        expect.objectContaining({
          adminIds: [],
          participantIds: ['identity-a', 'identity-c', 'identity-d'],
        }),
      );
    });

    it('lets only the creator promote and demote', () => {
      const group = conversation(100, 'group', 0, roster);

      expect(group.canPromote(member('identity-c'), member('identity-a'))).toBe(
        true,
      );
      expect(group.canPromote(member('identity-c'), member('identity-b'))).toBe(
        false,
      );
      expect(group.canPromote(member('identity-b'), member('identity-a'))).toBe(
        false,
      );
      expect(group.canPromote(member('identity-a'), member('identity-a'))).toBe(
        false,
      );
      expect(group.canDemote(member('identity-b'), member('identity-a'))).toBe(
        true,
      );
      expect(group.canDemote(member('identity-b'), member('identity-b'))).toBe(
        false,
      );

      group.promote(member('identity-c'), member('identity-a'), new Timestamp(1));
      group.demote(member('identity-b'), member('identity-a'), new Timestamp(2));

      expect(group.toPrimitives().adminIds).toEqual(['identity-c']);
    });

    it('lets every member but the creator leave', () => {
      const group = conversation(100, 'group', 0, roster);

      expect(group.canLeave(member('identity-a'))).toBe(false);
      expect(group.canLeave(member('identity-c'))).toBe(true);
      expect(group.canLeave(member('identity-z'))).toBe(false);

      group.leave(member('identity-b'), new Timestamp(200));

      expect(group.toPrimitives()).toEqual(
        expect.objectContaining({
          adminIds: [],
          participantIds: ['identity-a', 'identity-c', 'identity-d'],
        }),
      );
      expect(() =>
        group.leave(member('identity-a'), new Timestamp(300)),
      ).toThrow(ConversationRosterChangeNotAllowedError);
    });

    it('never changes the roster of a direct conversation', () => {
      const direct = conversation();

      expect(direct.canLeave(member('identity-b'))).toBe(false);
      expect(() =>
        direct.leave(member('identity-b'), new Timestamp(200)),
      ).toThrow(ConversationRosterChangeNotAllowedError);
    });
  });
});
