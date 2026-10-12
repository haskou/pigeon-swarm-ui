import { DomainError } from '@haskou/value-objects';

export class ConversationKeyRequiredError extends DomainError {
  public constructor() {
    super('Conversation key is required.');
  }
}
