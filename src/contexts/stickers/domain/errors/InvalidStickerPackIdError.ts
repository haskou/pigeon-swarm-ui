import { DomainError } from '@haskou/value-objects';

export class InvalidStickerPackIdError extends DomainError {
  public constructor() {
    super('Sticker pack id is required.');
  }
}
