import { DomainError } from '@haskou/value-objects';

export class CallIdRequiredError extends DomainError {
  public constructor() {
    super('Call id is required.');
  }
}
