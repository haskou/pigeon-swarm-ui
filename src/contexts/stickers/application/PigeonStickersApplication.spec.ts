import type {
  Session,
  StickerPackResource,
} from '../../../shared/domain/pigeonResources.types';

import { PigeonStickersApplication } from './PigeonStickersApplication';

describe(PigeonStickersApplication.name, () => {
  type Dependencies = ConstructorParameters<
    typeof PigeonStickersApplication
  >[0];

  function gatewayDouble(): jest.Mocked<Dependencies> {
    return {
      apiUrl: jest.fn(),
      listStickerPacks: jest.fn(),
      markStickerUsed: jest.fn(),
    } as unknown as jest.Mocked<Dependencies>;
  }

  it('lists packs through a validated owner filter', async () => {
    const gateway = gatewayDouble();
    const packs = [{ id: 'pack-1' }] as StickerPackResource[];
    gateway.listStickerPacks.mockResolvedValue(packs);
    const application = new PigeonStickersApplication(gateway);

    await expect(
      application.list({ ownerIdentityId: 'identity-1' }),
    ).resolves.toBe(packs);
    expect(gateway.listStickerPacks).toHaveBeenCalledWith({
      ownerIdentityId: 'identity-1',
    });
  });

  it('marks the exact sticker reference as recently used', async () => {
    const gateway = gatewayDouble();
    const application = new PigeonStickersApplication(gateway);
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;

    await application.markUsed(session, {
      assetCid: 'sticker-cid',
      packId: 'pack-1',
      stickerId: 'sticker-1',
    });

    expect(gateway.markStickerUsed).toHaveBeenCalledWith(
      session,
      'pack-1',
      'sticker-1',
    );
  });

  it('builds sticker asset URLs through the API boundary', () => {
    const gateway = gatewayDouble();
    gateway.apiUrl.mockReturnValue('https://example.test/api/ipfs/cid');
    const application = new PigeonStickersApplication(gateway);

    expect(application.assetUrl('cid/with-symbols')).toBe(
      'https://example.test/api/ipfs/cid',
    );
    expect(gateway.apiUrl).toHaveBeenCalledWith('/ipfs/cid%2Fwith-symbols');
  });
});
