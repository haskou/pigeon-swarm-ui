import type { StickerAdder } from '../../../contexts/stickers/application/add-sticker-to-pack/StickerAdder';
import type { StickerPackCreator } from '../../../contexts/stickers/application/create-sticker-pack/StickerPackCreator';
import type { StickerRemover } from '../../../contexts/stickers/application/delete-sticker/StickerRemover';
import type { StickerFavoriter } from '../../../contexts/stickers/application/favorite-sticker/StickerFavoriter';
import type { StickerLibraryFinder } from '../../../contexts/stickers/application/get-my-stickers/StickerLibraryFinder';
import type { StickerPackFinder } from '../../../contexts/stickers/application/get-sticker-pack/StickerPackFinder';
import type { ListStickerPacks } from '../../../contexts/stickers/application/list-sticker-packs/ListStickerPacks';
import type { StickerUsageMarker } from '../../../contexts/stickers/application/mark-sticker-used/StickerUsageMarker';
import type { StickerPackSaver } from '../../../contexts/stickers/application/save-sticker-pack/StickerPackSaver';
import type { StickerUnfavoriter } from '../../../contexts/stickers/application/unfavorite-sticker/StickerUnfavoriter';
import type { StickerPackUnsaver } from '../../../contexts/stickers/application/unsave-sticker-pack/StickerPackUnsaver';
import type { StickerPackRenamer } from '../../../contexts/stickers/application/update-sticker-pack/StickerPackRenamer';
import type { StickerUpdater } from '../../../contexts/stickers/application/update-sticker/StickerUpdater';

export type StickerUseCases = {
  adder: StickerAdder;
  creator: StickerPackCreator;
  favoriter: StickerFavoriter;
  libraryFinder: StickerLibraryFinder;
  packFinder: StickerPackFinder;
  packLister: ListStickerPacks;
  packRenamer: StickerPackRenamer;
  packSaver: StickerPackSaver;
  packUnsaver: StickerPackUnsaver;
  remover: StickerRemover;
  unfavoriter: StickerUnfavoriter;
  updater: StickerUpdater;
  usageMarker: StickerUsageMarker;
};
