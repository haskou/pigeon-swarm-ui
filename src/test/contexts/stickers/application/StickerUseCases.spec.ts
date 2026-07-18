import { mock, type MockProxy } from 'jest-mock-extended';

import type { StickerLibraryRepository } from '../../../../contexts/stickers/domain/repositories/StickerLibraryRepository';
import type { StickerPackRepository } from '../../../../contexts/stickers/domain/repositories/StickerPackRepository';

import { AddStickerToPackMessage } from '../../../../contexts/stickers/application/add-sticker-to-pack/messages/AddStickerToPackMessage';
import { StickerAdder } from '../../../../contexts/stickers/application/add-sticker-to-pack/StickerAdder';
import { CreateStickerPackMessage } from '../../../../contexts/stickers/application/create-sticker-pack/messages/CreateStickerPackMessage';
import { StickerPackCreator } from '../../../../contexts/stickers/application/create-sticker-pack/StickerPackCreator';
import { DeleteStickerMessage } from '../../../../contexts/stickers/application/delete-sticker/messages/DeleteStickerMessage';
import { StickerRemover } from '../../../../contexts/stickers/application/delete-sticker/StickerRemover';
import { FavoriteStickerMessage } from '../../../../contexts/stickers/application/favorite-sticker/messages/FavoriteStickerMessage';
import { StickerFavoriter } from '../../../../contexts/stickers/application/favorite-sticker/StickerFavoriter';
import { GetMyStickersMessage } from '../../../../contexts/stickers/application/get-my-stickers/messages/GetMyStickersMessage';
import { StickerLibraryFinder } from '../../../../contexts/stickers/application/get-my-stickers/StickerLibraryFinder';
import { GetStickerPackMessage } from '../../../../contexts/stickers/application/get-sticker-pack/messages/GetStickerPackMessage';
import { StickerPackFinder } from '../../../../contexts/stickers/application/get-sticker-pack/StickerPackFinder';
import { ListStickerPacks } from '../../../../contexts/stickers/application/list-sticker-packs/ListStickerPacks';
import { ListStickerPacksMessage } from '../../../../contexts/stickers/application/list-sticker-packs/messages/ListStickerPacksMessage';
import { MarkStickerUsedMessage } from '../../../../contexts/stickers/application/mark-sticker-used/messages/MarkStickerUsedMessage';
import { StickerUsageMarker } from '../../../../contexts/stickers/application/mark-sticker-used/StickerUsageMarker';
import { SaveStickerPackMessage } from '../../../../contexts/stickers/application/save-sticker-pack/messages/SaveStickerPackMessage';
import { StickerPackSaver } from '../../../../contexts/stickers/application/save-sticker-pack/StickerPackSaver';
import { UnfavoriteStickerMessage } from '../../../../contexts/stickers/application/unfavorite-sticker/messages/UnfavoriteStickerMessage';
import { StickerUnfavoriter } from '../../../../contexts/stickers/application/unfavorite-sticker/StickerUnfavoriter';
import { UnsaveStickerPackMessage } from '../../../../contexts/stickers/application/unsave-sticker-pack/messages/UnsaveStickerPackMessage';
import { StickerPackUnsaver } from '../../../../contexts/stickers/application/unsave-sticker-pack/StickerPackUnsaver';
import { UpdateStickerPackMessage } from '../../../../contexts/stickers/application/update-sticker-pack/messages/UpdateStickerPackMessage';
import { StickerPackRenamer } from '../../../../contexts/stickers/application/update-sticker-pack/StickerPackRenamer';
import { UpdateStickerMessage } from '../../../../contexts/stickers/application/update-sticker/messages/UpdateStickerMessage';
import { StickerUpdater } from '../../../../contexts/stickers/application/update-sticker/StickerUpdater';
import { stickerLibraryFixture } from '../StickerLibraryFixture';
import { stickerPackFixture } from '../StickerPackFixture';

const stickerInput = {
  actorIdentityId: 'identity-a',
  assetExternalIdentifier: 'asset-b',
  contentType: 'image/webp',
  height: 128,
  occurredAt: 200,
  packId: 'pack-a',
  sizeBytes: 512,
  type: 'static',
  width: 128,
};

describe('Sticker use cases', () => {
  let libraries: MockProxy<StickerLibraryRepository>;
  let packs: MockProxy<StickerPackRepository>;

  beforeEach(() => {
    libraries = mock<StickerLibraryRepository>();
    packs = mock<StickerPackRepository>();
    packs.find.mockResolvedValue(stickerPackFixture());
    packs.save.mockResolvedValue(stickerPackFixture());
    libraries.find.mockResolvedValue(stickerLibraryFixture());
    libraries.save.mockResolvedValue(stickerLibraryFixture());
  });

  it('creates, finds, and lists sticker packs through the repository', async () => {
    packs.create.mockResolvedValue(stickerPackFixture());
    packs.search.mockResolvedValue([stickerPackFixture()]);

    await new StickerPackCreator(packs).create(
      new CreateStickerPackMessage('identity-a', 'Daily', 100),
    );
    await new StickerPackFinder(packs).find(
      new GetStickerPackMessage('pack-a'),
    );
    await new ListStickerPacks(packs).list(
      new ListStickerPacksMessage({ ownerIdentityId: 'identity-a' }),
    );

    expect(packs.create).toHaveBeenCalledTimes(1);
    expect(packs.find).toHaveBeenCalledTimes(1);
    expect(packs.search).toHaveBeenCalledTimes(1);
  });

  it('renames, adds, updates, and removes through the pack aggregate', async () => {
    await new StickerPackRenamer(packs).rename(
      new UpdateStickerPackMessage('identity-a', 'pack-a', 'Memes', 200),
    );
    await new StickerAdder(packs).add(
      new AddStickerToPackMessage(stickerInput),
    );
    await new StickerUpdater(packs).update(
      new UpdateStickerMessage({ ...stickerInput, stickerId: 'sticker-a' }),
    );
    await new StickerRemover(packs).remove(
      new DeleteStickerMessage('identity-a', 'pack-a', 'sticker-a', 200),
    );

    expect(packs.save).toHaveBeenCalledTimes(4);
  });

  it('finds and mutates the personal sticker library', async () => {
    await new StickerLibraryFinder(libraries).find(
      new GetMyStickersMessage('identity-a'),
    );
    await new StickerFavoriter(libraries, packs).favorite(
      new FavoriteStickerMessage('identity-a', 'pack-a', 'sticker-a', 200),
    );
    await new StickerUnfavoriter(libraries).unfavorite(
      new UnfavoriteStickerMessage('identity-a', 'pack-a', 'sticker-a', 200),
    );
    await new StickerPackSaver(libraries, packs).save(
      new SaveStickerPackMessage('identity-a', 'pack-a', 200),
    );
    await new StickerPackUnsaver(libraries).unsave(
      new UnsaveStickerPackMessage('identity-a', 'pack-a', 200),
    );
    await new StickerUsageMarker(libraries, packs).mark(
      new MarkStickerUsedMessage('identity-a', 'pack-a', 'sticker-a', 200),
    );

    expect(libraries.find).toHaveBeenCalledTimes(6);
    expect(libraries.save).toHaveBeenCalledTimes(5);
  });
});
