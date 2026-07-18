import { mock } from 'jest-mock-extended';

import type { PollRepository } from '../../../../../contexts/polls/domain/repositories/PollRepository';

import { VotePollMessage } from '../../../../../contexts/polls/application/vote-poll/messages/VotePollMessage';
import { PollVoter } from '../../../../../contexts/polls/application/vote-poll/PollVoter';
import { PollVoterId } from '../../../../../contexts/polls/domain/value-objects/PollVoterId';
import { pollFixture } from '../../pollFixture';

describe(PollVoter.name, () => {
  it('casts the vote on the aggregate before persistence', async () => {
    const repository = mock<PollRepository>();
    const poll = pollFixture();
    repository.find.mockResolvedValue(poll);
    repository.vote.mockImplementation((candidate) =>
      Promise.resolve(candidate),
    );

    await new PollVoter(repository).vote(
      new VotePollMessage('identity-b', 'poll-a', ['option-a'], 200),
    );

    expect(poll.hasVoteFrom(PollVoterId.fromString('identity-b'))).toBe(true);
    expect(repository.vote).toHaveBeenCalledWith(
      poll,
      expect.objectContaining({}),
    );
  });
});
