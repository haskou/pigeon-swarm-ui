import { DomainError } from '@haskou/value-objects';

export class AttachmentFilenameRequiredError extends DomainError {
  public constructor() {
    super('Attachment filename is required.');
  }
}
