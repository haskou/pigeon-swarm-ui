import { StickerOwnerId } from '../../../../../contexts/stickers/domain/value-objects/StickerOwnerId';
import { StickerLibraryMapper } from '../../../../../contexts/stickers/infrastructure/http/StickerLibraryMapper';
import { StickerMapper } from '../../../../../contexts/stickers/infrastructure/http/StickerMapper';
import { StickerPackMapper } from '../../../../../contexts/stickers/infrastructure/http/StickerPackMapper';
import {
  stickerLibraryResource,
  stickerPackResource,
  stickerResource,
} from '../../StickerResourceFixture';

describe('Sticker HTTP mappers', () => {
  const stickers = new StickerMapper();
  const packs = new StickerPackMapper(stickers);
  const libraries = new StickerLibraryMapper(packs, stickers);

  it('maps sticker and pack resources without leaking HTTP shapes', () => {
    expect(
      stickers.toResource(stickers.fromResource(stickerResource())),
    ).toEqual(stickerResource());
    expect(packs.toResource(packs.fromResource(stickerPackResource()))).toEqual(
      stickerPackResource(),
    );
  });

  it('maps a personal library for its owning identity', () => {
    const resource = stickerLibraryResource();

    expect(
      libraries.toResource(
        libraries.fromResource(
          resource,
          StickerOwnerId.fromString('identity-a'),
        ),
      ),
    ).toEqual(resource);
  });
});
