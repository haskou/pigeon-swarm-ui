import { Timestamp } from '@haskou/value-objects';
import { mock } from 'jest-mock-extended';

import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { StickerId } from '../../../../../contexts/stickers/domain/value-objects/StickerId';
import { StickerOwnerId } from '../../../../../contexts/stickers/domain/value-objects/StickerOwnerId';
import { StickerPackId } from '../../../../../contexts/stickers/domain/value-objects/StickerPackId';
import { PigeonStickerLibraryRepository } from '../../../../../contexts/stickers/infrastructure/http/PigeonStickerLibraryRepository';
import { PigeonStickersApi } from '../../../../../contexts/stickers/infrastructure/http/PigeonStickersApi';
import { StickerAccessContexts } from '../../../../../contexts/stickers/infrastructure/http/StickerAccessContexts';
import { StickerLibraryMapper } from '../../../../../contexts/stickers/infrastructure/http/StickerLibraryMapper';
import { StickerMapper } from '../../../../../contexts/stickers/infrastructure/http/StickerMapper';
import { StickerPackMapper } from '../../../../../contexts/stickers/infrastructure/http/StickerPackMapper';
import { populatedStickerLibraryFixture } from '../../StickerLibraryFixture';
import { stickerLibraryResource } from '../../StickerResourceFixture';

describe(PigeonStickerLibraryRepository.name, () => {
  it('persists personal library events and reloads their projection', async () => {
    const api = mock<PigeonStickersApi>();
    const contexts = new StickerAccessContexts();
    const stickers = new StickerMapper();
    const packs = new StickerPackMapper(stickers);
    const mapper = new StickerLibraryMapper(packs, stickers);
    const repository = new PigeonStickerLibraryRepository(
      api,
      contexts,
      mapper,
    );
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;
    const ownerId = StickerOwnerId.fromString('identity-a');
    const library = populatedStickerLibraryFixture();

    contexts.register(session);
    api.getMyStickers.mockResolvedValue(stickerLibraryResource());
    library.unfavorite(
      StickerPackId.fromString('pack-a'),
      StickerId.fromString('sticker-a'),
      new Timestamp(200),
    );
    library.unsave(StickerPackId.fromString('pack-a'), new Timestamp(200));

    await repository.save(library, ownerId);

    expect(api.unfavoriteSticker).toHaveBeenCalledWith(
      session,
      'pack-a',
      'sticker-a',
    );
    expect(api.unsavePack).toHaveBeenCalledWith(session, 'pack-a');
    expect(api.getMyStickers).toHaveBeenCalledWith(session);
  });
});
