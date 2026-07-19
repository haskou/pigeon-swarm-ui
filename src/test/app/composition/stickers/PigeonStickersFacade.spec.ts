import { mock, mockDeep } from 'jest-mock-extended';

import type { StickerUseCases } from '../../../../app/composition/stickers/StickerUseCases';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { PigeonStickersFacade } from '../../../../app/composition/stickers/PigeonStickersFacade';
import { Sticker } from '../../../../contexts/stickers/domain/entities/Sticker';
import { PigeonStickersApi } from '../../../../contexts/stickers/infrastructure/http/PigeonStickersApi';
import { StickerAccessContexts } from '../../../../contexts/stickers/infrastructure/http/StickerAccessContexts';
import { StickerLibraryMapper } from '../../../../contexts/stickers/infrastructure/http/StickerLibraryMapper';
import { StickerMapper } from '../../../../contexts/stickers/infrastructure/http/StickerMapper';
import { StickerPackMapper } from '../../../../contexts/stickers/infrastructure/http/StickerPackMapper';
import { stickerLibraryFixture } from '../../../contexts/stickers/StickerLibraryFixture';
import {
  stickerPackFixture,
  stickerPrimitives,
} from '../../../contexts/stickers/StickerPackFixture';

describe(PigeonStickersFacade.name, () => {
  it('adapts UI resources to application messages and domain results', async () => {
    const api = mock<PigeonStickersApi>();
    const useCases = mockDeep<StickerUseCases>();
    const contexts = new StickerAccessContexts();
    const stickers = new StickerMapper();
    const packs = new StickerPackMapper(stickers);
    const libraries = new StickerLibraryMapper(packs, stickers);
    const facade = new PigeonStickersFacade(
      api,
      (path) => `https://example.test/api${path}`,
      contexts,
      libraries,
      packs,
      stickers,
      useCases,
    );
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;

    useCases.creator.create.mockResolvedValue(stickerPackFixture());
    useCases.adder.add.mockResolvedValue(
      Sticker.fromPrimitives({
        ...stickerPrimitives('server-sticker'),
        definition: {
          ...stickerPrimitives('server-sticker').definition,
          assetExternalIdentifier: 'duplicate-asset',
        },
      }),
    );
    useCases.packFinder.find.mockResolvedValue(stickerPackFixture());
    useCases.packLister.list.mockResolvedValue([stickerPackFixture()]);
    useCases.libraryFinder.find.mockResolvedValue(stickerLibraryFixture());

    await expect(
      facade.createPack(session, { name: 'Daily' }),
    ).resolves.toEqual(expect.objectContaining({ id: 'pack-a' }));
    await expect(
      facade.addToPack(session, 'pack-a', {
        assetCid: 'duplicate-asset',
        contentType: 'image/webp',
        dimensions: { height: 128, width: 128 },
        sizeBytes: 512,
        type: 'static',
      }),
    ).resolves.toEqual(expect.objectContaining({ id: 'server-sticker' }));
    await expect(facade.getPack('pack-a')).resolves.toEqual(
      expect.objectContaining({ id: 'pack-a' }),
    );
    await expect(facade.list()).resolves.toHaveLength(1);
    await expect(facade.getMyStickers(session)).resolves.toEqual({
      favoriteStickers: [],
      recentStickers: [],
      savedPacks: [],
    });
    expect(facade.assetUrl('asset/a')).toBe(
      'https://example.test/api/ipfs/asset%2Fa',
    );
  });

  it('keeps sticker usage and asset upload sessions in composition', async () => {
    const api = mock<PigeonStickersApi>();
    const useCases = mockDeep<StickerUseCases>();
    const contexts = new StickerAccessContexts();
    const stickers = new StickerMapper();
    const packs = new StickerPackMapper(stickers);
    const facade = new PigeonStickersFacade(
      api,
      (path) => path,
      contexts,
      new StickerLibraryMapper(packs, stickers),
      packs,
      stickers,
      useCases,
    );
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;
    const file = new File(['sticker'], 'sticker.webp', {
      type: 'image/webp',
    });
    const upload = {
      cid: 'asset-a',
      contentType: 'image/webp',
      filename: 'sticker.webp',
      size: file.size,
    };

    api.uploadAsset.mockResolvedValue(upload);

    await facade.markUsed(session, {
      assetCid: 'asset-a',
      packId: 'pack-a',
      stickerId: 'sticker-a',
    });
    await expect(facade.uploadAsset(session, file)).resolves.toBe(upload);

    expect(useCases.usageMarker.mark).toHaveBeenCalledTimes(1);
    expect(api.uploadAsset).toHaveBeenCalledWith(session, file);
  });
});
