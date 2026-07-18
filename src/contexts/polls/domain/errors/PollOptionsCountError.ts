import { DomainError } from '@haskou/value-objects';

export class PollOptionsCountError extends DomainError {
  public constructor() {
    super('A poll must contain between 2 and 10 options.');
  }
}
