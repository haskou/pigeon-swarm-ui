import type { ListStickerPacksPort } from '../../../../../contexts/stickers/application/ports/ListStickerPacksPort';
import type { StickerPackResource } from '../../../../../shared/domain/pigeonResources.types';

import { ListStickerPacks } from '../../../../../contexts/stickers/application/list-sticker-packs/ListStickerPacks';
import { ListStickerPacksMessage } from '../../../../../contexts/stickers/application/list-sticker-packs/messages/ListStickerPacksMessage';

describe(ListStickerPacks.name, () => {
  it('lists sticker packs with the requested owner filter', async () => {
    const stickerPack = {
      id: 'pack-1',
      name: 'Arquitectura',
      ownerIdentityId: 'identity-1',
      stickers: [],
    } satisfies StickerPackResource;
    const port: ListStickerPacksPort = {
      list: jest.fn().mockResolvedValue([stickerPack]),
    };
    const message = new ListStickerPacksMessage({
      ownerIdentityId: 'identity-1',
    });

    await expect(new ListStickerPacks(port).list(message)).resolves.toEqual([
      stickerPack,
    ]);

    expect(port.list).toHaveBeenCalledWith(message);
    expect(message.getOwnerIdentityId()).toBe('identity-1');
  });
});
