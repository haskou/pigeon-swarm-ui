import { DomainError } from '@haskou/value-objects';

export class InvalidPollVoterIdError extends DomainError {
  public constructor() {
    super('Poll voter id is required.');
  }
}
