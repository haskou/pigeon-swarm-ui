import { DomainError } from '@haskou/value-objects';

export class GroupCallCannotBeStartedError extends DomainError {
  public constructor() {
    super('This client does not start group calls.');
  }
}
