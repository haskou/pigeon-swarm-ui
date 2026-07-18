import { PollVote } from '../../../../../contexts/polls/domain/entities/PollVote';
import { PollVoterId } from '../../../../../contexts/polls/domain/value-objects/PollVoterId';

describe(PollVote.name, () => {
  it('normalizes and compares voter identities', () => {
    const vote = PollVote.fromPrimitives({
      createdAt: 100,
      optionIds: ['option-a'],
      voterIdentityId: 'identity-a',
    });

    expect(vote.belongsTo(PollVoterId.fromString('identity-a'))).toBe(true);
  });
});
