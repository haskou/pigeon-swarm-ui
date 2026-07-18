import { Timestamp } from '@haskou/value-objects';
import { mock } from 'jest-mock-extended';

import type { PigeonPollsApi } from '../../../../../contexts/polls/infrastructure/http/PigeonPollsApi';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PollActorId } from '../../../../../contexts/polls/domain/value-objects/PollActorId';
import { PollOptionId } from '../../../../../contexts/polls/domain/value-objects/PollOptionId';
import { PollVoterId } from '../../../../../contexts/polls/domain/value-objects/PollVoterId';
import { PigeonPollRepository } from '../../../../../contexts/polls/infrastructure/http/PigeonPollRepository';
import { PollAccessContexts } from '../../../../../contexts/polls/infrastructure/http/PollAccessContexts';
import { PollMapper } from '../../../../../contexts/polls/infrastructure/http/PollMapper';
import { pollResourceFixture } from '../../PollResourceFixture';

describe(PigeonPollRepository.name, () => {
  it('persists the aggregate vote through the poll API', async () => {
    const api = mock<PigeonPollsApi>();
    const contexts = new PollAccessContexts();
    const session = {
      identity: { id: 'identity-b' },
    } as unknown as Session;
    contexts.register(session);
    const mapper = new PollMapper();
    const poll = mapper.fromResource(pollResourceFixture());
    poll.vote(
      PollVoterId.fromString('identity-b'),
      [PollOptionId.fromString('option-a')],
      new Timestamp(200),
    );
    api.vote.mockResolvedValue(
      pollResourceFixture({
        votes: [
          {
            createdAt: 200,
            optionIds: ['option-a'],
            voterIdentityId: 'identity-b',
          },
        ],
      }),
    );

    await new PigeonPollRepository(api, contexts, mapper).vote(
      poll,
      PollActorId.fromString('identity-b'),
    );

    expect(api.vote).toHaveBeenCalledWith(session, 'poll-a', ['option-a']);
  });
});
