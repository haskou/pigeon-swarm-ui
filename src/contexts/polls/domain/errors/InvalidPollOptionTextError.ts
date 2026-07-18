import { DomainError } from '@haskou/value-objects';

export class InvalidPollOptionTextError extends DomainError {
  public constructor() {
    super('Poll option must contain between 1 and 120 characters.');
  }
}
