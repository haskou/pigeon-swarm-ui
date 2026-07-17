import { DomainError } from '@haskou/value-objects';

export class MessageAuthorIdRequiredError extends DomainError {
  public constructor() {
    super('Message author id is required.');
  }
}
