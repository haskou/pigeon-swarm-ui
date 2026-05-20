import { Timestamp } from '@haskou/value-objects';

import type { PollResource } from '../../../../shared/domain/pigeonResources.types';

import { PollOptionId } from '../value-objects/pollOptionId';
import { PollVoterId } from '../value-objects/pollVoterId';
import { Poll } from './poll';

const pollResource = (overrides: Partial<PollResource> = {}): PollResource => ({
  allowsMultipleVotes: false,
  createdAt: 100,
  creatorIdentityId: 'identity-a',
  id: 'poll-a',
  options: [
    { id: 'option-a', text: 'A' },
    { id: 'option-b', text: 'B' },
  ],
  question: 'Choose?',
  scope: {
    conversationId: 'conversation-a',
    networkId: 'network-a',
    type: 'group_conversation',
  },
  status: 'open',
  votes: [],
  ...overrides,
});

describe('Poll', () => {
  it('casts one vote per voter', () => {
    const poll = Poll.fromResource(pollResource());
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
    expect(poll.toResource().votes).toHaveLength(1);
    expect(poll.pullDomainEvents()).toHaveLength(3);
  });

  it('rejects votes once closed', () => {
    const poll = Poll.fromResource(pollResource());

    poll.close();

    expect(() =>
      poll.vote(
        PollVoterId.fromString('identity-b'),
        [PollOptionId.fromString('option-a')],
        new Timestamp(200),
      ),
    ).toThrow('Closed polls cannot receive votes.');
  });
});
