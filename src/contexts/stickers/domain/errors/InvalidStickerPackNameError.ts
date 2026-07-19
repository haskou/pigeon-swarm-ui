import { DomainError } from '@haskou/value-objects';

export class InvalidStickerPackNameError extends DomainError {
  public constructor() {
    super('Sticker pack name is required.');
  }
}
