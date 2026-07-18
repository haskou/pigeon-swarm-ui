import { DomainError } from '@haskou/value-objects';

export class MessageConversationIdRequiredError extends DomainError {
  public constructor() {
    super('Message conversation id is required.');
  }
}
