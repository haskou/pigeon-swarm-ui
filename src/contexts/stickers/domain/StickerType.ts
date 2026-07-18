import { Enum } from '@haskou/value-objects';

enum StickerTypePrimitive {
  ANIMATED = 'animated',
  STATIC = 'static',
  VIDEO = 'video',
}

export class StickerType extends Enum<string> {
  public static readonly ANIMATED = new StickerType(
    StickerTypePrimitive.ANIMATED,
  );

  public static readonly STATIC = new StickerType(StickerTypePrimitive.STATIC);

  public static readonly VIDEO = new StickerType(StickerTypePrimitive.VIDEO);

  public static fromPrimitives(value: string): StickerType {
    return new StickerType(value);
  }

  private constructor(value: string) {
    super(value);
  }

  public getValues(): string[] {
    return Object.values(StickerTypePrimitive);
  }
}
