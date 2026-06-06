import type { StickerPackResource } from '../../../../shared/domain/pigeonResources.types';
import type { ListStickerPacksPort } from '../ports/ListStickerPacksPort';

import { ListStickerPacks } from './ListStickerPacks';
import { ListStickerPacksMessage } from './messages/ListStickerPacksMessage';

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
