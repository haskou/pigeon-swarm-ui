import { DomainError } from '@haskou/value-objects';

export class ConversationRosterChangeNotAllowedError extends DomainError {
  public constructor() {
    super('Conversation roster change is not allowed.');
  }
}
