import { DomainError } from '@haskou/value-objects';

export class InvalidPollIdError extends DomainError {
  public constructor() {
    super('Poll id is required.');
  }
}
