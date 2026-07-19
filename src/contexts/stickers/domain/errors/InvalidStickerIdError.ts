import { DomainError } from '@haskou/value-objects';

export class InvalidStickerIdError extends DomainError {
  public constructor() {
    super('Sticker id is required.');
  }
}
