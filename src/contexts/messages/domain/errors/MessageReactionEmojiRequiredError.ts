import { DomainError } from '@haskou/value-objects';

export class MessageReactionEmojiRequiredError extends DomainError {
  public constructor() {
    super('Message reaction emoji is required.');
  }
}
