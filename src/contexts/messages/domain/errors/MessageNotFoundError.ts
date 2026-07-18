import { DomainError } from '@haskou/value-objects';

export class MessageNotFoundError extends DomainError {
  public constructor() {
    super('Message was not found.');
  }
}
