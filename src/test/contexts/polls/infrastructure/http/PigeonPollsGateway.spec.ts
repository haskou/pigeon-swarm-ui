import type { PigeonPollsApi } from '../../../../../contexts/polls/infrastructure/http/PigeonPollsApi';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PigeonPollsGateway } from '../../../../../contexts/polls/infrastructure/http/PigeonPollsGateway';

function session(): Session {
  return {
    identity: { id: 'identity-1' },
    keychain: { conversations: {}, version: 1 },
  } as unknown as Session;
}

function pollsDouble(): {
  gateway: PigeonPollsGateway;
  polls: jest.Mocked<Pick<PigeonPollsApi, 'create' | 'vote'>>;
} {
  const polls = {
    create: jest.fn(),
    vote: jest.fn(),
  } as jest.Mocked<Pick<PigeonPollsApi, 'create' | 'vote'>>;

  return {
    gateway: new PigeonPollsGateway(polls as unknown as PigeonPollsApi),
    polls,
  };
}

describe(PigeonPollsGateway.name, () => {
  it('delegates poll creation to the infrastructure API', async () => {
    const { gateway, polls } = pollsDouble();
    const result = {} as never;
    const input = {
      options: ['yes', 'no'],
      question: 'Continue?',
    } as never;
    polls.create.mockResolvedValue(result);

    await expect(gateway.createPoll(session(), input)).resolves.toBe(result);
    expect(polls.create).toHaveBeenCalledWith(session(), input);
  });

  it('delegates poll votes with their option identifiers', async () => {
    const { gateway, polls } = pollsDouble();
    const result = {} as never;
    polls.vote.mockResolvedValue(result);

    await expect(
      gateway.votePoll(session(), 'poll-1', ['option-1']),
    ).resolves.toBe(result);
    expect(polls.vote).toHaveBeenCalledWith(session(), 'poll-1', ['option-1']);
  });
});
