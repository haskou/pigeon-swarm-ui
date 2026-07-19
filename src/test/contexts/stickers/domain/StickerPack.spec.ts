import { Timestamp } from '@haskou/value-objects';

import { Sticker } from '../../../../contexts/stickers/domain/entities/Sticker';
import { StickerAdded } from '../../../../contexts/stickers/domain/events/StickerAdded';
import { StickerPackRenamed } from '../../../../contexts/stickers/domain/events/StickerPackRenamed';
import { StickerRemoved } from '../../../../contexts/stickers/domain/events/StickerRemoved';
import { StickerUpdated } from '../../../../contexts/stickers/domain/events/StickerUpdated';
import { StickerDefinition } from '../../../../contexts/stickers/domain/StickerDefinition';
import { StickerDimensions } from '../../../../contexts/stickers/domain/StickerDimensions';
import { StickerPack } from '../../../../contexts/stickers/domain/StickerPack';
import { StickerType } from '../../../../contexts/stickers/domain/StickerType';
import { StickerAssetExternalIdentifier } from '../../../../contexts/stickers/domain/value-objects/StickerAssetExternalIdentifier';
import { StickerByteSize } from '../../../../contexts/stickers/domain/value-objects/StickerByteSize';
import { StickerContentType } from '../../../../contexts/stickers/domain/value-objects/StickerContentType';
import { StickerId } from '../../../../contexts/stickers/domain/value-objects/StickerId';
import { StickerOwnerId } from '../../../../contexts/stickers/domain/value-objects/StickerOwnerId';
import { StickerPackId } from '../../../../contexts/stickers/domain/value-objects/StickerPackId';
import { StickerPackName } from '../../../../contexts/stickers/domain/value-objects/StickerPackName';
import { stickerPackFixture } from '../StickerPackFixture';

const definition = () =>
  StickerDefinition.create(
    StickerAssetExternalIdentifier.fromString('asset-b'),
    StickerContentType.fromString('image/webp'),
    StickerDimensions.create(128, 128),
    new StickerByteSize(256),
    StickerType.STATIC,
  );

describe(StickerPack.name, () => {
  it('creates a pack and records its lifecycle event', () => {
    const pack = StickerPack.create(
      StickerOwnerId.fromString('identity-a'),
      StickerPackName.fromString('Daily'),
      new Timestamp(100),
    );

    expect(pack.ownedBy(StickerOwnerId.fromString('identity-a'))).toBe(true);
    expect(pack.pullDomainEvents()).toEqual([
      expect.objectContaining({ type: 'StickerPackCreated' }),
    ]);
  });

  it('renames, adds, updates, and removes stickers through the aggregate', () => {
    const pack = stickerPackFixture();
    const addedSticker = Sticker.create(definition(), new Timestamp(200));

    pack.rename(StickerPackName.fromString('Memes'), new Timestamp(200));
    pack.add(addedSticker, new Timestamp(200));
    pack.replace(
      Sticker.update(addedSticker.getId(), definition(), new Timestamp(300)),
      new Timestamp(300),
    );
    pack.remove(StickerId.fromString('sticker-a'), new Timestamp(400));

    expect(pack.contains(addedSticker.getId())).toBe(true);
    expect(pack.belongsTo(StickerPackId.fromString('pack-a'))).toBe(true);
    expect(pack.pullDomainEvents()).toEqual([
      expect.any(StickerPackRenamed),
      expect.any(StickerAdded),
      expect.any(StickerUpdated),
      expect.any(StickerRemoved),
    ]);
  });

  it('rejects mutations for stickers outside the pack', () => {
    const pack = stickerPackFixture();

    expect(() =>
      pack.remove(StickerId.fromString('missing'), new Timestamp(200)),
    ).toThrow('Sticker was not found in the pack.');
  });
});
