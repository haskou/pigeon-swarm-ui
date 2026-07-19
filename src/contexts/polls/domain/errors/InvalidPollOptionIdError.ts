import { DomainError } from '@haskou/value-objects';

export class InvalidPollOptionIdError extends DomainError {
  public constructor() {
    super('Poll option id is required.');
  }
}
