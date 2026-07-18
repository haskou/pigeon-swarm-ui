import { DomainError } from '@haskou/value-objects';

export class PollAccessContextNotFoundError extends DomainError {
  public constructor() {
    super('Poll access context is not registered.');
  }
}
