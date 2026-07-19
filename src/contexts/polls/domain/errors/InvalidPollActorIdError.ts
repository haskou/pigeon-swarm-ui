import { DomainError } from '@haskou/value-objects';

export class InvalidPollActorIdError extends DomainError {
  public constructor() {
    super('Poll actor id is required.');
  }
}
