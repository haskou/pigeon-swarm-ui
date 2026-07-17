import { DomainError } from '@haskou/value-objects';

export class ConversationParticipantAlreadyExistsError extends DomainError {
  public constructor() {
    super('Conversation participant already exists.');
  }
}
