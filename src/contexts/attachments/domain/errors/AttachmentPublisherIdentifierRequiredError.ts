import { DomainError } from '@haskou/value-objects';

export class AttachmentPublisherIdentifierRequiredError extends DomainError {
  public constructor() {
    super('Attachment publisher external identifier is required.');
  }
}
