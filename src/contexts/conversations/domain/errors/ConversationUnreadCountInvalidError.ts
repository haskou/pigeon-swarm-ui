import { DomainError } from '@haskou/value-objects';

export class ConversationUnreadCountInvalidError extends DomainError {
  public constructor() {
    super('Conversation unread count cannot be negative.');
  }
}
