import { DomainError } from '@haskou/value-objects';

export class ConversationParticipantNotFoundError extends DomainError {
  public constructor() {
    super('Conversation participant was not found.');
  }
}
