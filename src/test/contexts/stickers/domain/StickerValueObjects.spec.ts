import { InvalidStickerAssetExternalIdentifierError } from '../../../../contexts/stickers/domain/errors/InvalidStickerAssetExternalIdentifierError';
import { InvalidStickerByteSizeError } from '../../../../contexts/stickers/domain/errors/InvalidStickerByteSizeError';
import { InvalidStickerContentTypeError } from '../../../../contexts/stickers/domain/errors/InvalidStickerContentTypeError';
import { InvalidStickerDimensionsError } from '../../../../contexts/stickers/domain/errors/InvalidStickerDimensionsError';
import { InvalidStickerIdError } from '../../../../contexts/stickers/domain/errors/InvalidStickerIdError';
import { InvalidStickerOwnerIdError } from '../../../../contexts/stickers/domain/errors/InvalidStickerOwnerIdError';
import { InvalidStickerPackIdError } from '../../../../contexts/stickers/domain/errors/InvalidStickerPackIdError';
import { InvalidStickerPackNameError } from '../../../../contexts/stickers/domain/errors/InvalidStickerPackNameError';
import { StickerDimensions } from '../../../../contexts/stickers/domain/StickerDimensions';
import { StickerType } from '../../../../contexts/stickers/domain/StickerType';
import { StickerAssetExternalIdentifier } from '../../../../contexts/stickers/domain/value-objects/StickerAssetExternalIdentifier';
import { StickerByteSize } from '../../../../contexts/stickers/domain/value-objects/StickerByteSize';
import { StickerContentType } from '../../../../contexts/stickers/domain/value-objects/StickerContentType';
import { StickerId } from '../../../../contexts/stickers/domain/value-objects/StickerId';
import { StickerOwnerId } from '../../../../contexts/stickers/domain/value-objects/StickerOwnerId';
import { StickerPackId } from '../../../../contexts/stickers/domain/value-objects/StickerPackId';
import { StickerPackName } from '../../../../contexts/stickers/domain/value-objects/StickerPackName';

describe('Sticker value objects', () => {
  it('rejects invalid sticker values with cohesive errors', () => {
    expect(() => StickerAssetExternalIdentifier.fromString(' ')).toThrow(
      InvalidStickerAssetExternalIdentifierError,
    );
    expect(() => new StickerByteSize(-1)).toThrow(InvalidStickerByteSizeError);
    expect(() => StickerContentType.fromString(' ')).toThrow(
      InvalidStickerContentTypeError,
    );
    expect(() => StickerDimensions.create(0, 10)).toThrow(
      InvalidStickerDimensionsError,
    );
    expect(() => StickerId.fromString(' ')).toThrow(InvalidStickerIdError);
    expect(() => StickerOwnerId.fromString(' ')).toThrow(
      InvalidStickerOwnerIdError,
    );
    expect(() => StickerPackId.fromString(' ')).toThrow(
      InvalidStickerPackIdError,
    );
    expect(() => StickerPackName.fromString(' ')).toThrow(
      InvalidStickerPackNameError,
    );
  });

  it('models every supported sticker media type', () => {
    expect(
      StickerType.fromPrimitives('animated').isEqual(StickerType.ANIMATED),
    ).toBe(true);
    expect(
      StickerType.fromPrimitives('static').isEqual(StickerType.STATIC),
    ).toBe(true);
    expect(StickerType.fromPrimitives('video').isEqual(StickerType.VIDEO)).toBe(
      true,
    );
  });
});
