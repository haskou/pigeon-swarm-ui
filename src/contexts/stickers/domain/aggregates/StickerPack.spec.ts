import type { StickerPackResource } from '../../../../shared/domain/pigeonResources.types';

import { StickerId } from '../value-objects/StickerId';
import { StickerPackName } from '../value-objects/StickerPackName';
import { StickerPack } from './StickerPack';

const stickerPackResource = (
  overrides: Partial<StickerPackResource> = {},
): StickerPackResource => ({
  id: 'pack-a',
  name: 'Daily',
  ownerIdentityId: 'identity-a',
  stickers: [
    {
      assetCid: 'cid-a',
      contentType: 'image/png',
      id: 'sticker-a',
      type: 'static',
    },
  ],
  ...overrides,
});

describe('StickerPack', () => {
  it('checks sticker membership through value objects', () => {
    const pack = StickerPack.fromResource(stickerPackResource());

    expect(pack.contains(StickerId.fromString('sticker-a'))).toBe(true);
  });

  it('renames a sticker pack and records a domain event', () => {
    const pack = StickerPack.fromResource(stickerPackResource());
    const name = StickerPackName.fromString('Favorites');

    pack.rename(name);

    expect(pack.getName().isEqual(name)).toBe(true);
    expect(pack.pullDomainEvents()).toHaveLength(1);
  });
});
