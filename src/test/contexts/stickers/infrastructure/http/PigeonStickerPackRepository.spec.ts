import { Timestamp } from '@haskou/value-objects';
import { mock } from 'jest-mock-extended';

import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { Sticker } from '../../../../../contexts/stickers/domain/entities/Sticker';
import { StickerAssetExternalIdentifier } from '../../../../../contexts/stickers/domain/value-objects/StickerAssetExternalIdentifier';
import { StickerByteSize } from '../../../../../contexts/stickers/domain/value-objects/StickerByteSize';
import { StickerContentType } from '../../../../../contexts/stickers/domain/value-objects/StickerContentType';
import { StickerDefinition } from '../../../../../contexts/stickers/domain/value-objects/StickerDefinition';
import { StickerDimensions } from '../../../../../contexts/stickers/domain/value-objects/StickerDimensions';
import { StickerId } from '../../../../../contexts/stickers/domain/value-objects/StickerId';
import { StickerOwnerId } from '../../../../../contexts/stickers/domain/value-objects/StickerOwnerId';
import { StickerPackId } from '../../../../../contexts/stickers/domain/value-objects/StickerPackId';
import { StickerPackName } from '../../../../../contexts/stickers/domain/value-objects/StickerPackName';
import { StickerType } from '../../../../../contexts/stickers/domain/value-objects/StickerType';
import { PigeonStickerPackRepository } from '../../../../../contexts/stickers/infrastructure/http/PigeonStickerPackRepository';
import { PigeonStickersApi } from '../../../../../contexts/stickers/infrastructure/http/PigeonStickersApi';
import { StickerAccessContexts } from '../../../../../contexts/stickers/infrastructure/http/StickerAccessContexts';
import { StickerMapper } from '../../../../../contexts/stickers/infrastructure/http/StickerMapper';
import { StickerPackMapper } from '../../../../../contexts/stickers/infrastructure/http/StickerPackMapper';
import { stickerPackFixture } from '../../StickerPackFixture';
import {
  stickerPackResource,
  stickerResource,
} from '../../StickerResourceFixture';

const definition = () =>
  StickerDefinition.create(
    StickerAssetExternalIdentifier.fromString('asset-b'),
    StickerContentType.fromString('image/webp'),
    StickerDimensions.create(128, 128),
    new StickerByteSize(256),
    StickerType.STATIC,
  );

describe(PigeonStickerPackRepository.name, () => {
  it('persists every pack mutation through its matching HTTP operation', async () => {
    const api = mock<PigeonStickersApi>();
    const contexts = new StickerAccessContexts();
    const stickers = new StickerMapper();
    const packs = new StickerPackMapper(stickers);
    const repository = new PigeonStickerPackRepository(
      api,
      contexts,
      packs,
      stickers,
    );
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;
    const actorId = StickerOwnerId.fromString('identity-a');
    const pack = stickerPackFixture();
    const added = Sticker.create(definition(), new Timestamp(200));

    contexts.register(session);
    api.getPack.mockResolvedValue(stickerPackResource());
    pack.add(added, new Timestamp(200));
    pack.pullDomainEvents();
    pack.rename(StickerPackName.fromString('Memes'), new Timestamp(200));
    pack.replace(
      Sticker.update(added.getId(), definition(), new Timestamp(300)),
      new Timestamp(300),
    );
    pack.remove(StickerId.fromString('sticker-a'), new Timestamp(400));

    await repository.save(pack, actorId);

    expect(api.updatePack).toHaveBeenCalledTimes(1);
    expect(api.updateSticker).toHaveBeenCalledTimes(1);
    expect(api.deleteSticker).toHaveBeenCalledTimes(1);
  });

  it('returns the sticker resource created by the server', async () => {
    const api = mock<PigeonStickersApi>();
    const contexts = new StickerAccessContexts();
    const stickers = new StickerMapper();
    const repository = new PigeonStickerPackRepository(
      api,
      contexts,
      new StickerPackMapper(stickers),
      stickers,
    );
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;
    const actorId = StickerOwnerId.fromString('identity-a');
    const pack = stickerPackFixture();

    contexts.register(session);
    pack.add(
      Sticker.create(definition(), new Timestamp(200)),
      new Timestamp(200),
    );
    api.addSticker.mockResolvedValue(stickerResource('server-sticker'));

    const added = await repository.add(pack, actorId);

    expect(added.toPrimitives().id).toBe('server-sticker');
    expect(api.getPack).not.toHaveBeenCalled();
  });

  it('creates, finds, and searches aggregate roots', async () => {
    const api = mock<PigeonStickersApi>();
    const contexts = new StickerAccessContexts();
    const stickers = new StickerMapper();
    const packs = new StickerPackMapper(stickers);
    const repository = new PigeonStickerPackRepository(
      api,
      contexts,
      packs,
      stickers,
    );
    const session = {
      identity: { id: 'identity-a' },
    } as unknown as Session;
    const actorId = StickerOwnerId.fromString('identity-a');

    contexts.register(session);
    api.createPack.mockResolvedValue(stickerPackResource());
    api.getPack.mockResolvedValue(stickerPackResource());
    api.listPacks.mockResolvedValue([stickerPackResource()]);

    await repository.create(stickerPackFixture(), actorId);
    await repository.find(StickerPackId.fromString('pack-a'));
    await repository.search(actorId);

    expect(api.createPack).toHaveBeenCalledTimes(1);
    expect(api.getPack).toHaveBeenCalledTimes(1);
    expect(api.listPacks).toHaveBeenCalledWith({
      ownerIdentityId: 'identity-a',
    });
  });
});
