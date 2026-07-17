import { DomainError } from '@haskou/value-objects';

export class MessageLinkPreviewUrlInvalidError extends DomainError {
  public constructor() {
    super('Message link preview URL must use HTTP or HTTPS.');
  }
}
