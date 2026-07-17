import { DomainError } from '@haskou/value-objects';

export class AttachmentIdRequiredError extends DomainError {
  public constructor() {
    super('Attachment id is required.');
  }
}
