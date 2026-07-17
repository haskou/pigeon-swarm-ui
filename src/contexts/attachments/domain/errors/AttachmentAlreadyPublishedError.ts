import { DomainError } from '@haskou/value-objects';

export class AttachmentAlreadyPublishedError extends DomainError {
  public constructor() {
    super('Attachment has already been published.');
  }
}
