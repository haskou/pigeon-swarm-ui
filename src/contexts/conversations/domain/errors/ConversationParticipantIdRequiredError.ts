import { DomainError } from '@haskou/value-objects';

export class ConversationParticipantIdRequiredError extends DomainError {
  public constructor() {
    super('Conversation participant id is required.');
  }
}
