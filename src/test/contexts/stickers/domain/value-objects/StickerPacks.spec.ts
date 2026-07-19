import { StickerPack } from '../../../../../contexts/stickers/domain/StickerPack';
import { StickerPackId } from '../../../../../contexts/stickers/domain/value-objects/StickerPackId';
import { StickerPacks } from '../../../../../contexts/stickers/domain/value-objects/StickerPacks';
import { stickerPackFixture } from '../../StickerPackFixture';

describe('StickerPacks', () => {
  it('keeps packs unique by aggregate identity', () => {
    const original = stickerPackFixture();
    const duplicate = StickerPack.fromPrimitives(original.toPrimitives());
    const packs = StickerPacks.fromArray([original]);

    expect(packs.save(duplicate)).toBe(false);
    expect(packs.toArray()).toEqual([original]);
  });

  it('removes a pack by its domain identity', () => {
    const packs = StickerPacks.fromArray([stickerPackFixture()]);

    expect(packs.unsave(StickerPackId.fromString('pack-a'))).toBe(true);
    expect(packs.toArray()).toEqual([]);
  });
});
