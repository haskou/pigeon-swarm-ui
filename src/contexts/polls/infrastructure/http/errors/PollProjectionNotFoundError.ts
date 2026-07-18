import { DomainError } from '@haskou/value-objects';

export class PollProjectionNotFoundError extends DomainError {
  public constructor() {
    super('Poll resource projection is not available.');
  }
}
