import { mock } from 'jest-mock-extended';

import type { PollRepository } from '../../../../../contexts/polls/domain/repositories/PollRepository';

import { CreatePollMessage } from '../../../../../contexts/polls/application/create-poll/messages/CreatePollMessage';
import { PollCreator } from '../../../../../contexts/polls/application/create-poll/PollCreator';

describe(PollCreator.name, () => {
  it('creates a valid aggregate before persistence', async () => {
    const repository = mock<PollRepository>();
    repository.create.mockImplementation((poll) => Promise.resolve(poll));

    const poll = await new PollCreator(repository).create(
      new CreatePollMessage({
        actorIdentityId: 'identity-a',
        allowsMultipleVotes: false,
        expiresAt: null,
        firstScopeIdentifier: 'conversation-a',
        occurredAt: 100,
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        question: 'Choose?',
        scopeType: 'group_conversation',
        secondScopeIdentifier: undefined,
      }),
    );

    expect(repository.create).toHaveBeenCalledWith(
      poll,
      expect.objectContaining({}),
    );
    expect(poll.pullDomainEvents()).toEqual([
      expect.objectContaining({ type: 'PollCreated' }),
    ]);
  });
});
