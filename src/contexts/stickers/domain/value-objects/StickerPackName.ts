import { DomainError, StringValueObject } from '@haskou/value-objects';

export class StickerPackName extends StringValueObject {
  public static readonly MAX_LENGTH = 80;

  public static fromString(value: string): StickerPackName {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new DomainError('Sticker pack name is required.');
    }

    return new StickerPackName(trimmedValue);
  }

  private constructor(value: string) {
    super(value, StickerPackName.MAX_LENGTH);
  }
}
