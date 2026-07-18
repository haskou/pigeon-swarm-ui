import { Timestamp } from '@haskou/value-objects';

import { StickerFavorited } from '../../../../contexts/stickers/domain/events/StickerFavorited';
import { StickerPackSaved } from '../../../../contexts/stickers/domain/events/StickerPackSaved';
import { StickerPackUnsaved } from '../../../../contexts/stickers/domain/events/StickerPackUnsaved';
import { StickerUnfavorited } from '../../../../contexts/stickers/domain/events/StickerUnfavorited';
import { StickerUsed } from '../../../../contexts/stickers/domain/events/StickerUsed';
import { StickerId } from '../../../../contexts/stickers/domain/value-objects/StickerId';
import { StickerPackId } from '../../../../contexts/stickers/domain/value-objects/StickerPackId';
import {
  populatedStickerLibraryFixture,
  stickerLibraryFixture,
} from '../StickerLibraryFixture';
import { stickerPackFixture } from '../StickerPackFixture';

describe('StickerLibrary', () => {
  it('owns favorite, recent, and saved sticker state', () => {
    const library = stickerLibraryFixture();
    const pack = stickerPackFixture();
    const stickerId = StickerId.fromString('sticker-a');

    library.favorite(pack, stickerId, new Timestamp(100));
    library.markUsed(pack, stickerId, new Timestamp(200));
    library.save(pack, new Timestamp(300));

    expect(library.pullDomainEvents()).toEqual([
      expect.any(StickerFavorited),
      expect.any(StickerUsed),
      expect.any(StickerPackSaved),
    ]);
  });

  it('removes favorites and saved packs transactionally', () => {
    const library = populatedStickerLibraryFixture();

    library.unfavorite(
      StickerPackId.fromString('pack-a'),
      StickerId.fromString('sticker-a'),
      new Timestamp(200),
    );
    library.unsave(StickerPackId.fromString('pack-a'), new Timestamp(200));

    expect(library.pullDomainEvents()).toEqual([
      expect.any(StickerUnfavorited),
      expect.any(StickerPackUnsaved),
    ]);
  });
});
