import { DomainError } from '@haskou/value-objects';

export class ConversationNetworkIdRequiredError extends DomainError {
  public constructor() {
    super('Conversation network id is required.');
  }
}
