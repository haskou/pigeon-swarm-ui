import { DomainError } from '@haskou/value-objects';

export class PresenceSharingRequiresDirectConversationError extends DomainError {
  public constructor() {
    super('Presence is shared only with the peer of a direct conversation.');
  }
}
