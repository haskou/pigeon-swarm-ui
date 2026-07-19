import { mock } from 'jest-mock-extended';

import type { PollRepository } from '../../../../../contexts/polls/domain/repositories/PollRepository';

import { RemovePollVoteMessage } from '../../../../../contexts/polls/application/remove-poll-vote/messages/RemovePollVoteMessage';
import { PollVoteRemover } from '../../../../../contexts/polls/application/remove-poll-vote/PollVoteRemover';
import { PollVoterId } from '../../../../../contexts/polls/domain/value-objects/PollVoterId';
import { pollFixture } from '../../pollFixture';

describe(PollVoteRemover.name, () => {
  it('removes the actor vote before persistence', async () => {
    const repository = mock<PollRepository>();
    const poll = pollFixture({
      votes: [
        {
          createdAt: 100,
          optionIds: ['option-a'],
          voterIdentityId: 'identity-b',
        },
      ],
    });
    repository.find.mockResolvedValue(poll);
    repository.removeVote.mockImplementation((candidate) =>
      Promise.resolve(candidate),
    );

    await new PollVoteRemover(repository).remove(
      new RemovePollVoteMessage('identity-b', 'poll-a', 200),
    );

    expect(poll.hasVoteFrom(PollVoterId.fromString('identity-b'))).toBe(false);
    expect(repository.removeVote).toHaveBeenCalledWith(
      poll,
      expect.objectContaining({}),
    );
  });
});
