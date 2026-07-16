import { DomainError } from '@haskou/value-objects';

export class AttachmentSourceIdentifierRequiredError extends DomainError {
  public constructor() {
    super('Attachment source external identifier is required.');
  }
}
