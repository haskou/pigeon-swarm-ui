import { DomainError } from '@haskou/value-objects';

export class AttachmentByteSizeCannotBeNegativeError extends DomainError {
  public constructor() {
    super('Attachment byte size cannot be negative.');
  }
}
