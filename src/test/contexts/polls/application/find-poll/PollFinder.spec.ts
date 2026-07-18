import { mock } from 'jest-mock-extended';

import type { PollRepository } from '../../../../../contexts/polls/domain/repositories/PollRepository';

import { FindPollMessage } from '../../../../../contexts/polls/application/find-poll/messages/FindPollMessage';
import { PollFinder } from '../../../../../contexts/polls/application/find-poll/PollFinder';
import { pollFixture } from '../../PollFixture';

describe(PollFinder.name, () => {
  it('finds a poll through its domain repository', async () => {
    const repository = mock<PollRepository>();
    const poll = pollFixture();
    repository.find.mockResolvedValue(poll);

    await expect(
      new PollFinder(repository).find(
        new FindPollMessage('identity-a', 'poll-a'),
      ),
    ).resolves.toBe(poll);
  });
});
