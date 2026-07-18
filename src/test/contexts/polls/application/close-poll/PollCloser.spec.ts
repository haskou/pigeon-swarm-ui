import { mock } from 'jest-mock-extended';

import type { PollRepository } from '../../../../../contexts/polls/domain/repositories/PollRepository';

import { ClosePollMessage } from '../../../../../contexts/polls/application/close-poll/messages/ClosePollMessage';
import { PollCloser } from '../../../../../contexts/polls/application/close-poll/PollCloser';
import { pollFixture } from '../../PollFixture';

describe(PollCloser.name, () => {
  it('closes the aggregate before persisting it', async () => {
    const repository = mock<PollRepository>();
    const poll = pollFixture();
    repository.find.mockResolvedValue(poll);
    repository.close.mockImplementation((candidate) =>
      Promise.resolve(candidate),
    );

    await new PollCloser(repository).close(
      new ClosePollMessage('identity-a', 'poll-a', 200),
    );

    expect(repository.close).toHaveBeenCalledWith(
      poll,
      expect.objectContaining({}),
    );
    expect(poll.pullDomainEvents()).toEqual([
      expect.objectContaining({ type: 'PollClosed' }),
    ]);
  });
});
