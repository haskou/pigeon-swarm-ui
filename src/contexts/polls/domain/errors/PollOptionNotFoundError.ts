import { DomainError } from '@haskou/value-objects';

export class PollOptionNotFoundError extends DomainError {
  public constructor() {
    super('Poll option does not exist.');
  }
}
