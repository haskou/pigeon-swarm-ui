import { DomainError } from '@haskou/value-objects';

export class AttachmentNetworkIdRequiredError extends DomainError {
  public constructor() {
    super('Attachment network id is required.');
  }
}
