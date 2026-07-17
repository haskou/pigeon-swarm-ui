import { DomainError } from '@haskou/value-objects';

export class GroupConversationNameRequiredError extends DomainError {
  public constructor() {
    super('Group conversation name is required.');
  }
}
