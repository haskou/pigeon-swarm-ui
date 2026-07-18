import { PollMapper } from '../../../../../contexts/polls/infrastructure/http/PollMapper';
import { pollResourceFixture } from '../../PollResourceFixture';

describe(PollMapper.name, () => {
  it('hydrates and projects a poll resource', () => {
    const mapper = new PollMapper();
    const resource = pollResourceFixture();
    const poll = mapper.fromResource(resource);

    expect(mapper.toResource(poll)).toEqual(resource);
  });

  it('serializes community poll creation without projection data', () => {
    const mapper = new PollMapper();
    const poll = mapper.fromResource(
      pollResourceFixture({
        scope: {
          channelId: 'channel-a',
          communityId: 'community-a',
          networkId: 'network-a',
          type: 'community_channel',
        },
      }),
    );

    expect(mapper.toCreateRequest(poll)).toEqual({
      allowsMultipleVotes: false,
      channelId: 'channel-a',
      communityId: 'community-a',
      expiresAt: null,
      options: [
        { id: 'option-a', text: 'A' },
        { id: 'option-b', text: 'B' },
      ],
      question: 'Choose?',
      scopeType: 'community_channel',
    });
  });
});
