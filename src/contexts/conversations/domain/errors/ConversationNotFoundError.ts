import { DomainError } from '@haskou/value-objects';

export class ConversationNotFoundError extends DomainError {
  public constructor() {
    super('Conversation was not found.');
  }
}
