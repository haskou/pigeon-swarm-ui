import { DomainError } from '@haskou/value-objects';

// eslint-disable-next-line max-len
export class PresenceSharingRequiresDirectConversationError extends DomainError {
  public constructor() {
    super('Presence is shared only with the peer of a direct conversation.');
  }
}
