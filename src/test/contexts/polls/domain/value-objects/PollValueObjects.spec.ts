import { InvalidPollActorIdError } from '../../../../../contexts/polls/domain/errors/InvalidPollActorIdError';
import { InvalidPollIdError } from '../../../../../contexts/polls/domain/errors/InvalidPollIdError';
import { InvalidPollOptionIdError } from '../../../../../contexts/polls/domain/errors/InvalidPollOptionIdError';
import { InvalidPollOptionTextError } from '../../../../../contexts/polls/domain/errors/InvalidPollOptionTextError';
import { InvalidPollQuestionError } from '../../../../../contexts/polls/domain/errors/InvalidPollQuestionError';
import { InvalidPollScopeIdentifierError } from '../../../../../contexts/polls/domain/errors/InvalidPollScopeIdentifierError';
import { InvalidPollVoterIdError } from '../../../../../contexts/polls/domain/errors/InvalidPollVoterIdError';
import { PollActorId } from '../../../../../contexts/polls/domain/value-objects/PollActorId';
import { PollId } from '../../../../../contexts/polls/domain/value-objects/PollId';
import { PollMultipleVotePermission } from '../../../../../contexts/polls/domain/value-objects/PollMultipleVotePermission';
import { PollOptionId } from '../../../../../contexts/polls/domain/value-objects/PollOptionId';
import { PollOptionText } from '../../../../../contexts/polls/domain/value-objects/PollOptionText';
import { PollQuestion } from '../../../../../contexts/polls/domain/value-objects/PollQuestion';
import { PollScopeIdentifier } from '../../../../../contexts/polls/domain/value-objects/PollScopeIdentifier';
import { PollScopeType } from '../../../../../contexts/polls/domain/value-objects/PollScopeType';
import { PollVoterId } from '../../../../../contexts/polls/domain/value-objects/PollVoterId';

describe('Poll value objects', () => {
  it('rejects invalid domain values with cohesive errors', () => {
    expect(() => PollActorId.fromString(' ')).toThrow(InvalidPollActorIdError);
    expect(() => PollId.fromString(' ')).toThrow(InvalidPollIdError);
    expect(() => PollOptionId.fromString(' ')).toThrow(
      InvalidPollOptionIdError,
    );
    expect(() => PollOptionText.fromString(' ')).toThrow(
      InvalidPollOptionTextError,
    );
    expect(() => PollQuestion.fromString(' ')).toThrow(
      InvalidPollQuestionError,
    );
    expect(() => PollScopeIdentifier.fromString(' ')).toThrow(
      InvalidPollScopeIdentifierError,
    );
    expect(() => PollVoterId.fromString(' ')).toThrow(InvalidPollVoterIdError);
  });

  it('normalizes PEM voter identifiers without exposing their primitives', () => {
    const rawVoterId = PollVoterId.fromString('identity-a');
    const pemVoterId = PollVoterId.fromString(
      '-----BEGIN PUBLIC KEY-----\nidentity-a\n-----END PUBLIC KEY-----',
    );

    expect(pemVoterId.isEqual(rawVoterId)).toBe(true);
  });

  it('models scope and multiple-vote behavior', () => {
    const singleVote = PollMultipleVotePermission.fromBoolean(false);
    const multipleVotes = PollMultipleVotePermission.fromBoolean(true);

    expect(singleVote.allows(1)).toBe(true);
    expect(singleVote.allows(2)).toBe(false);
    expect(multipleVotes.allows(2)).toBe(true);
    expect(PollScopeType.COMMUNITY_CHANNEL.isCommunityChannel()).toBe(true);
    expect(PollScopeType.GROUP_CONVERSATION.isCommunityChannel()).toBe(false);
  });
});
