import { Timestamp } from '@haskou/value-objects';

import { Poll } from '../../../../../contexts/polls/domain/Poll';
import { PollOptionId } from '../../../../../contexts/polls/domain/value-objects/PollOptionId';
import { PollVoterId } from '../../../../../contexts/polls/domain/value-objects/PollVoterId';

const pollPrimitives = (overrides: Record<string, unknown> = {}) => ({
  createdAt: 100,
  definition: {
    allowsMultipleVotes: false,
    creatorIdentityId: 'identity-a',
    expiresAt: null,
    options: [
      { id: 'option-a', text: 'A' },
      { id: 'option-b', text: 'B' },
    ],
    question: 'Choose?',
    scope: {
      firstIdentifier: 'conversation-a',
      secondIdentifier: undefined,
      type: 'group_conversation',
    },
  },
  id: 'poll-a',
  status: 'open',
  votes: [],
  ...overrides,
});

describe('Poll', () => {
  it('casts one vote per voter', () => {
    const poll = Poll.fromPrimitives(pollPrimitives());
    const voterId = PollVoterId.fromString('identity-b');

    poll.vote(
      voterId,
      [PollOptionId.fromString('option-a')],
      new Timestamp(200),
    );
    poll.vote(
      voterId,
      [PollOptionId.fromString('option-b')],
      new Timestamp(300),
    );

    expect(poll.hasVoteFrom(voterId)).toBe(true);
    expect(poll.hasVoteFrom(voterId)).toBe(true);
    expect(poll.pullDomainEvents()).toHaveLength(2);
  });

  it('rejects votes once closed', () => {
    const poll = Poll.fromPrimitives(pollPrimitives());

    poll.close(new Timestamp(150));

    expect(() =>
      poll.vote(
        PollVoterId.fromString('identity-b'),
        [PollOptionId.fromString('option-a')],
        new Timestamp(200),
      ),
    ).toThrow('Closed polls cannot receive votes.');
  });

  it('rejects unknown options and multiple selections in single-vote polls', () => {
    const poll = Poll.fromPrimitives(pollPrimitives());
    const voter = PollVoterId.fromString('identity-b');

    expect(() =>
      poll.vote(
        voter,
        [
          PollOptionId.fromString('option-a'),
          PollOptionId.fromString('option-b'),
        ],
        new Timestamp(200),
      ),
    ).toThrow('This poll accepts one option per vote.');
    expect(() =>
      poll.vote(
        voter,
        [PollOptionId.fromString('missing')],
        new Timestamp(200),
      ),
    ).toThrow('Poll option does not exist.');
  });

  it('removes an existing vote and records the lifecycle event', () => {
    const voter = PollVoterId.fromString('identity-b');
    const poll = Poll.fromPrimitives(
      pollPrimitives({
        votes: [
          {
            createdAt: 100,
            optionIds: ['option-a'],
            voterIdentityId: 'identity-b',
          },
        ],
      }),
    );

    poll.removeVote(voter, new Timestamp(300));

    expect(poll.hasVoteFrom(voter)).toBe(false);
    expect(poll.pullDomainEvents()).toEqual([
      expect.objectContaining({ type: 'PollVoteRemoved' }),
    ]);
  });
});
