import { DomainError } from '@haskou/value-objects';

export class InvalidStickerAssetExternalIdentifierError extends DomainError {
  public constructor() {
    super('Sticker asset external identifier is required.');
  }
}
