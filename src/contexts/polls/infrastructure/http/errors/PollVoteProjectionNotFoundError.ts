import { DomainError } from '@haskou/value-objects';

export class PollVoteProjectionNotFoundError extends DomainError {
  public constructor() {
    super('Poll vote selection is not available.');
  }
}
