import { DomainError } from '@haskou/value-objects';

export class MessageIdRequiredError extends DomainError {
  public constructor() {
    super('Message id is required.');
  }
}
