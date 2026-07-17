import { DomainError } from '@haskou/value-objects';

export class CallSignalIdRequiredError extends DomainError {
  public constructor() {
    super('Call signal id is required.');
  }
}
