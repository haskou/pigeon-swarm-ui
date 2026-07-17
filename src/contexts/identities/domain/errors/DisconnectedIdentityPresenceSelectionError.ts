import { DomainError } from '@haskou/value-objects';

export class DisconnectedIdentityPresenceSelectionError extends DomainError {
  public constructor() {
    super('Disconnected presence cannot be selected explicitly.');
  }
}
