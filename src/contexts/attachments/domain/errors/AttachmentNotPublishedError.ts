import { DomainError } from '@haskou/value-objects';

export class AttachmentNotPublishedError extends DomainError {
  public constructor() {
    super('Attachment has not been published.');
  }
}
