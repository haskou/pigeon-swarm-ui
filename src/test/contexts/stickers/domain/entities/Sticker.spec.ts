import { Timestamp } from '@haskou/value-objects';

import { Sticker } from '../../../../../contexts/stickers/domain/entities/Sticker';
import { StickerAssetExternalIdentifier } from '../../../../../contexts/stickers/domain/value-objects/StickerAssetExternalIdentifier';
import { StickerByteSize } from '../../../../../contexts/stickers/domain/value-objects/StickerByteSize';
import { StickerContentType } from '../../../../../contexts/stickers/domain/value-objects/StickerContentType';
import { StickerDefinition } from '../../../../../contexts/stickers/domain/value-objects/StickerDefinition';
import { StickerDimensions } from '../../../../../contexts/stickers/domain/value-objects/StickerDimensions';
import { StickerId } from '../../../../../contexts/stickers/domain/value-objects/StickerId';
import { StickerType } from '../../../../../contexts/stickers/domain/value-objects/StickerType';

const definition = StickerDefinition.create(
  StickerAssetExternalIdentifier.fromString('asset-a'),
  StickerContentType.fromString('image/webp'),
  StickerDimensions.create(128, 128),
  new StickerByteSize(512),
  StickerType.STATIC,
);

describe(Sticker.name, () => {
  it('preserves identity while replacing sticker content', () => {
    const stickerId = StickerId.fromString('sticker-a');
    const sticker = Sticker.update(stickerId, definition, new Timestamp(200));

    expect(sticker.belongsTo(stickerId)).toBe(true);
    expect(sticker.getId().isEqual(stickerId)).toBe(true);
  });
});
