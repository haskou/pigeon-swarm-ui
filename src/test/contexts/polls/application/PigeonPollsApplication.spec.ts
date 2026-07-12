import type {
  PollResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { PigeonPollsApplication } from '../../../../contexts/polls/application/PigeonPollsApplication';

describe(PigeonPollsApplication.name, () => {
  it('votes through validated poll and option identifiers', async () => {
    const vote = jest.fn();
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const poll = { id: 'poll-1' } as PollResource;
    vote.mockResolvedValue(poll);
    const application = new PigeonPollsApplication({
      votePoll: { vote },
    } as unknown as ConstructorParameters<typeof PigeonPollsApplication>[0]);

    await expect(
      application.vote(session, 'poll-1', ['option-1', 'option-2']),
    ).resolves.toBe(poll);
    expect(vote).toHaveBeenCalled();
  });
});
