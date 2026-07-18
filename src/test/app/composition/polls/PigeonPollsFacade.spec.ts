import { mock } from 'jest-mock-extended';

import type { PollUseCases } from '../../../../app/composition/polls/PollUseCases';
import type { PollVoter } from '../../../../contexts/polls/application/vote-poll/PollVoter';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { PigeonPollsFacade } from '../../../../app/composition/polls/PigeonPollsFacade';
import { PollAccessContexts } from '../../../../contexts/polls/infrastructure/http/PollAccessContexts';
import { PollMapper } from '../../../../contexts/polls/infrastructure/http/PollMapper';
import { pollResourceFixture } from '../../../contexts/polls/pollResourceFixture';

describe(PigeonPollsFacade.name, () => {
  it('translates primitive UI input into a vote use case message', async () => {
    const useCases = mock<PollUseCases>();
    const voter = mock<PollVoter>();
    const mapper = new PollMapper();
    const poll = mapper.fromResource(pollResourceFixture());
    useCases.voter = voter;
    voter.vote.mockResolvedValue(poll);
    const facade = new PigeonPollsFacade(
      new PollAccessContexts(),
      mapper,
      useCases,
    );
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;

    await expect(facade.vote(session, 'poll-a', ['option-a'])).resolves.toEqual(
      pollResourceFixture(),
    );
    const message = voter.vote.mock.calls[0]?.[0];

    expect(message?.getPollId().toString()).toBe('poll-a');
    expect(message?.getVoterId().toString()).toBe('identity-a');
  });
});
