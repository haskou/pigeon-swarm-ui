import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PollId } from '../../../domain/value-objects/pollId';
import { PollOptionId } from '../../../domain/value-objects/pollOptionId';

export class VotePollMessage {
  private readonly optionIds: PollOptionId[];
  private readonly pollId: PollId;

  public constructor(
    private readonly input: {
      optionIds: string[];
      pollId: string;
      session: Session;
    },
  ) {
    this.optionIds = input.optionIds.map((optionId) =>
      PollOptionId.fromString(optionId),
    );
    this.pollId = PollId.fromString(input.pollId);
  }

  public getOptionIds(): PollOptionId[] {
    return this.optionIds;
  }

  public getPollId(): PollId {
    return this.pollId;
  }

  public getSession(): Session {
    return this.input.session;
  }
}
