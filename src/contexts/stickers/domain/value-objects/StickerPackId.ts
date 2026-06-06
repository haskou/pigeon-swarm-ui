import { DomainError, StringValueObject } from '@haskou/value-objects';

export class StickerPackId extends StringValueObject {
  public static fromString(value: string): StickerPackId {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new DomainError('Sticker pack id is required.');
    }

    return new StickerPackId(trimmedValue);
  }

  private constructor(value: string) {
    super(value);
  }
}
