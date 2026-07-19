import { DomainError } from '@haskou/value-objects';

export class StickerNotFoundError extends DomainError {
  public constructor() {
    super('Sticker was not found in the pack.');
  }
}
