import { assert, type PrimitiveOf } from '@haskou/value-objects';

import { PollOption } from '../entities/PollOption';
import { PollOptionsCountError } from '../errors/PollOptionsCountError';
import { PollActorId } from './PollActorId';
import { PollExpiration } from './PollExpiration';
import { PollMultipleVotePermission } from './PollMultipleVotePermission';
import { PollOptionId } from './PollOptionId';
import { PollQuestion } from './PollQuestion';
import { PollScope } from './PollScope';

export class PollDefinition {
  public static create(
    creatorId: PollActorId,
    scope: PollScope,
    question: PollQuestion,
    options: PollOption[],
    multipleVotes: PollMultipleVotePermission,
    expiration: PollExpiration,
  ): PollDefinition {
    assert(
      options.length >= 2 && options.length <= 10,
      new PollOptionsCountError(),
    );

    return new PollDefinition(
      creatorId,
      scope,
      question,
      options,
      multipleVotes,
      expiration,
    );
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<PollDefinition>,
  ): PollDefinition {
    return PollDefinition.create(
      PollActorId.fromString(primitives.creatorIdentityId),
      PollScope.fromPrimitives(primitives.scope),
      PollQuestion.fromString(primitives.question),
      primitives.options.map(PollOption.fromPrimitives),
      PollMultipleVotePermission.fromBoolean(primitives.allowsMultipleVotes),
      PollExpiration.fromPrimitives(primitives.expiresAt),
    );
  }

  private constructor(
    private readonly creatorIdentityId: PollActorId,
    private readonly scope: PollScope,
    private readonly question: PollQuestion,
    private readonly options: PollOption[],
    private readonly allowsMultipleVotes: PollMultipleVotePermission,
    private readonly expiresAt: PollExpiration,
  ) {}

  public allowsSelection(optionCount: number): boolean {
    return this.allowsMultipleVotes.allows(optionCount);
  }

  public containsEveryOption(optionIds: PollOptionId[]): boolean {
    return optionIds.every((optionId) =>
      this.options.some((option) => option.belongsTo(optionId)),
    );
  }

  public toPrimitives() {
    return {
      allowsMultipleVotes: this.allowsMultipleVotes.valueOf(),
      creatorIdentityId: this.creatorIdentityId.toString(),
      expiresAt: this.expiresAt.toPrimitives(),
      options: this.options.map((option) => option.toPrimitives()),
      question: this.question.toString(),
      scope: this.scope.toPrimitives(),
    };
  }
}
