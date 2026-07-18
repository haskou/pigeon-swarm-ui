import { StringValueObject, assert } from '@haskou/value-objects';

import { InvalidPollActorIdError } from '../errors/InvalidPollActorIdError';

export class PollActorId extends StringValueObject {
  public static fromString(value: string): PollActorId {
    const actorId = value.trim();

    assert(actorId.length > 0, new InvalidPollActorIdError());

    return new PollActorId(actorId);
  }

  private constructor(value: string) {
    super(value);
  }
}
