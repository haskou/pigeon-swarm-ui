import type { VotePollPort } from '../../../../../contexts/polls/application/ports/VotePollPort';
import type {
  PollResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { VotePollMessage } from '../../../../../contexts/polls/application/vote-poll/messages/VotePollMessage';
import { VotePoll } from '../../../../../contexts/polls/application/vote-poll/VotePoll';
import { PollId } from '../../../../../contexts/polls/domain/value-objects/PollId';
import { PollOptionId } from '../../../../../contexts/polls/domain/value-objects/PollOptionId';

describe(VotePoll.name, () => {
  it('votes through poll id and option id value objects', async () => {
    const poll = {
      allowsMultipleVotes: true,
      createdAt: 1,
      creatorIdentityId: 'identity-1',
      id: 'poll-1',
      options: [
        { id: 'option-1', text: 'Sí' },
        { id: 'option-2', text: 'No' },
      ],
      question: '¿Seguimos?',
      scope: {
        channelId: 'channel-1',
        communityId: 'community-1',
        networkId: 'network-1',
        type: 'community_channel',
      },
      status: 'open',
      votes: [],
    } satisfies PollResource;
    const port: VotePollPort = {
      vote: jest.fn((message) => {
        expect(message.getPollId().isEqual(PollId.fromString('poll-1'))).toBe(
          true,
        );
        expect(
          message
            .getOptionIds()[0]
            ?.isEqual(PollOptionId.fromString('option-1')),
        ).toBe(true);

        return Promise.resolve(poll);
      }),
    };
    const session = { identity: { id: 'identity-1' } } as Session;
    const message = new VotePollMessage({
      optionIds: [' option-1 '],
      pollId: ' poll-1 ',
      session,
    });

    await expect(new VotePoll(port).vote(message)).resolves.toBe(poll);

    expect(port.vote).toHaveBeenCalledWith(message);
    expect(message.getSession()).toBe(session);
  });

  it('rejects empty poll and option identifiers at the message boundary', () => {
    const session = { identity: { id: 'identity-1' } } as Session;

    expect(
      () =>
        new VotePollMessage({
          optionIds: ['option-1'],
          pollId: ' ',
          session,
        }),
    ).toThrow('Poll id is required.');
    expect(
      () =>
        new VotePollMessage({
          optionIds: [' '],
          pollId: 'poll-1',
          session,
        }),
    ).toThrow('Poll option id is required.');
  });
});
