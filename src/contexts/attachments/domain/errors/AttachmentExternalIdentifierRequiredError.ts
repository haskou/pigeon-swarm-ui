import { DomainError } from '@haskou/value-objects';

export class AttachmentExternalIdentifierRequiredError extends DomainError {
  public constructor() {
    super('Attachment external identifier is required.');
  }
}
