import { DomainError } from '@haskou/value-objects';

export class InvalidStickerContentTypeError extends DomainError {
  public constructor() {
    super('Sticker content type is required.');
  }
}
