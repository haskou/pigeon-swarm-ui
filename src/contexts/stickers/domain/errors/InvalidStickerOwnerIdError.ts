import { DomainError } from '@haskou/value-objects';

export class InvalidStickerOwnerIdError extends DomainError {
  public constructor() {
    super('Sticker owner identity id is required.');
  }
}
