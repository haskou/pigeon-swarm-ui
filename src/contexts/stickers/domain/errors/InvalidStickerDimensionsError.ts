import { DomainError } from '@haskou/value-objects';

export class InvalidStickerDimensionsError extends DomainError {
  public constructor() {
    super('Sticker dimensions must be greater than zero.');
  }
}
