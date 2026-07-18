import { DomainError } from '@haskou/value-objects';

export class InvalidStickerByteSizeError extends DomainError {
  public constructor() {
    super('Sticker byte size cannot be negative.');
  }
}
