import { DomainError } from '@haskou/value-objects';

export class AttachmentContentTypeRequiredError extends DomainError {
  public constructor() {
    super('Attachment content type is required.');
  }
}
