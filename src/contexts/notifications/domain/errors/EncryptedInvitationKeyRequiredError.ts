import { DomainError } from '@haskou/value-objects';

export class EncryptedInvitationKeyRequiredError extends DomainError {
  public constructor() {
    super('Encrypted invitation key is required.');
  }
}
