import { DomainError } from '@haskou/value-objects';

export class AttachmentEncryptionNetworkRequiredError extends DomainError {
  public constructor() {
    super('Encrypted attachment publication requires a network.');
  }
}
