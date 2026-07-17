import { DomainError } from '@haskou/value-objects';

export class ConversationIdRequiredError extends DomainError {
  public constructor() {
    super('Conversation id is required.');
  }
}
