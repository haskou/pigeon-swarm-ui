import { Timestamp } from '@haskou/value-objects';

import { PollOption } from '../../../domain/entities/PollOption';
import { PollActorId } from '../../../domain/value-objects/PollActorId';
import { PollDefinition } from '../../../domain/value-objects/PollDefinition';
import { PollExpiration } from '../../../domain/value-objects/PollExpiration';
import { PollMultipleVotePermission } from '../../../domain/value-objects/PollMultipleVotePermission';
import { PollOptionId } from '../../../domain/value-objects/PollOptionId';
import { PollOptionText } from '../../../domain/value-objects/PollOptionText';
import { PollQuestion } from '../../../domain/value-objects/PollQuestion';
import { PollScope } from '../../../domain/value-objects/PollScope';

export class CreatePollMessage {
  public constructor(
    private readonly input: {
      actorIdentityId: string;
      allowsMultipleVotes: boolean;
      expiresAt: null | number | undefined;
      firstScopeIdentifier: string;
      occurredAt: number;
      options: { id: string; text: string }[];
      question: string;
      scopeType: string;
      secondScopeIdentifier: string | undefined;
    },
  ) {}

  public getActorId(): PollActorId {
    return PollActorId.fromString(this.input.actorIdentityId);
  }

  public getDefinition(): PollDefinition {
    return PollDefinition.create(
      this.getActorId(),
      this.getScope(),
      this.getQuestion(),
      this.getOptions(),
      this.getMultipleVotePermission(),
      this.getExpiration(),
    );
  }

  public getExpiration(): PollExpiration {
    return PollExpiration.fromPrimitives(this.input.expiresAt);
  }

  public getMultipleVotePermission(): PollMultipleVotePermission {
    return PollMultipleVotePermission.fromBoolean(
      this.input.allowsMultipleVotes,
    );
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.input.occurredAt);
  }

  public getOptions(): PollOption[] {
    return this.input.options.map(
      (option) =>
        new PollOption(
          PollOptionId.fromString(option.id),
          PollOptionText.fromString(option.text),
        ),
    );
  }

  public getQuestion(): PollQuestion {
    return PollQuestion.fromString(this.input.question);
  }

  public getScope(): PollScope {
    return PollScope.fromPrimitives({
      firstIdentifier: this.input.firstScopeIdentifier,
      secondIdentifier: this.input.secondScopeIdentifier,
      type: this.input.scopeType,
    });
  }
}
