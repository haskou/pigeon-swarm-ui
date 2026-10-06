import { DomainError } from '@haskou/value-objects';

export class ConversationGroupNonceRequiredError extends DomainError {
  public constructor() {
    super('Conversation group nonce is required.');
  }
}
