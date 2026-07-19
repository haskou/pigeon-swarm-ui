import { Timestamp } from '@haskou/value-objects';

import { Sticker } from '../../../../../contexts/stickers/domain/entities/Sticker';
import { StickerUsage } from '../../../../../contexts/stickers/domain/entities/StickerUsage';
import { StickerAssetExternalIdentifier } from '../../../../../contexts/stickers/domain/value-objects/StickerAssetExternalIdentifier';
import { StickerByteSize } from '../../../../../contexts/stickers/domain/value-objects/StickerByteSize';
import { StickerContentType } from '../../../../../contexts/stickers/domain/value-objects/StickerContentType';
import { StickerDefinition } from '../../../../../contexts/stickers/domain/value-objects/StickerDefinition';
import { StickerDimensions } from '../../../../../contexts/stickers/domain/value-objects/StickerDimensions';
import { StickerId } from '../../../../../contexts/stickers/domain/value-objects/StickerId';
import { StickerPackId } from '../../../../../contexts/stickers/domain/value-objects/StickerPackId';
import { StickerType } from '../../../../../contexts/stickers/domain/value-objects/StickerType';

describe(StickerUsage.name, () => {
  it('matches a sticker only inside its pack', () => {
    const stickerId = StickerId.fromString('sticker-a');
    const packId = StickerPackId.fromString('pack-a');
    const sticker = Sticker.update(
      stickerId,
      StickerDefinition.create(
        StickerAssetExternalIdentifier.fromString('asset-a'),
        StickerContentType.fromString('image/webp'),
        StickerDimensions.create(128, 128),
        new StickerByteSize(512),
        StickerType.STATIC,
      ),
      new Timestamp(100),
    );
    const usage = StickerUsage.favorite(packId, sticker, new Timestamp(100));

    expect(usage.references(packId, stickerId)).toBe(true);
    expect(
      usage.references(StickerPackId.fromString('pack-b'), stickerId),
    ).toBe(false);
  });
});
