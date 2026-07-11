import type {
  PollResource,
  Session,
} from '../../../shared/domain/pigeonResources.types';

import { PigeonPollsApplication } from './PigeonPollsApplication';

describe(PigeonPollsApplication.name, () => {
  it('votes through validated poll and option identifiers', async () => {
    const gateway = {
      votePoll: jest.fn(),
    } as unknown as jest.Mocked<
      ConstructorParameters<typeof PigeonPollsApplication>[0]
    >;
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const poll = { id: 'poll-1' } as PollResource;
    gateway.votePoll.mockResolvedValue(poll);
    const application = new PigeonPollsApplication(gateway);

    await expect(
      application.vote(session, 'poll-1', ['option-1', 'option-2']),
    ).resolves.toBe(poll);
    expect(gateway.votePoll).toHaveBeenCalledWith(session, 'poll-1', [
      'option-1',
      'option-2',
    ]);
  });
});
