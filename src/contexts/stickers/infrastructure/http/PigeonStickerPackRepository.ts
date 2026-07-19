import { assert } from '@haskou/value-objects';

import type { Sticker } from '../../domain/entities/Sticker';
import type { StickerPackRepository } from '../../domain/repositories/StickerPackRepository';
import type { StickerPack } from '../../domain/StickerPack';
import type { StickerOwnerId } from '../../domain/value-objects/StickerOwnerId';
import type { StickerPackId } from '../../domain/value-objects/StickerPackId';

import { StickerAdded } from '../../domain/events/StickerAdded';
import { StickerPackRenamed } from '../../domain/events/StickerPackRenamed';
import { StickerRemoved } from '../../domain/events/StickerRemoved';
import { StickerUpdated } from '../../domain/events/StickerUpdated';
import { StickerAdditionNotRecordedError } from './errors/StickerAdditionNotRecordedError';
import { PigeonStickersApi } from './PigeonStickersApi';
import { StickerAccessContexts } from './StickerAccessContexts';
import { StickerMapper } from './StickerMapper';
import { StickerPackMapper } from './StickerPackMapper';

export class PigeonStickerPackRepository implements StickerPackRepository {
  public constructor(
    private readonly api: PigeonStickersApi,
    private readonly contexts: StickerAccessContexts,
    private readonly packs: StickerPackMapper,
    private readonly stickers: StickerMapper,
  ) {}

  public async add(
    pack: StickerPack,
    actorId: StickerOwnerId,
  ): Promise<Sticker> {
    const event = pack
      .pullDomainEvents()
      .find((candidate) => candidate instanceof StickerAdded);

    assert(
      event instanceof StickerAdded,
      new StickerAdditionNotRecordedError(),
    );

    return this.stickers.fromResource(
      await this.api.addSticker(
        this.contexts.find(actorId),
        event.aggregateId,
        this.stickers.toInput(pack.findSticker(event.stickerId)),
      ),
    );
  }

  public async create(
    pack: StickerPack,
    actorId: StickerOwnerId,
  ): Promise<StickerPack> {
    const resource = await this.api.createPack(
      this.contexts.find(actorId),
      this.packs.toCreateInput(pack),
    );
    pack.pullDomainEvents();

    return this.packs.fromResource(resource);
  }

  public async find(packId: StickerPackId): Promise<StickerPack> {
    return this.packs.fromResource(await this.api.getPack(packId.toString()));
  }

  public async save(
    pack: StickerPack,
    actorId: StickerOwnerId,
  ): Promise<StickerPack> {
    const events = pack.pullDomainEvents();

    for (const event of events) {
      if (event instanceof StickerPackRenamed) {
        await this.api.updatePack(
          this.contexts.find(actorId),
          event.aggregateId,
          this.packs.toCreateInput(pack),
        );
      }

      if (event instanceof StickerUpdated) {
        await this.api.updateSticker(
          this.contexts.find(actorId),
          event.aggregateId,
          event.stickerId.toString(),
          this.stickers.toInput(pack.findSticker(event.stickerId)),
        );
      }

      if (event instanceof StickerRemoved) {
        await this.api.deleteSticker(
          this.contexts.find(actorId),
          event.aggregateId,
          event.stickerId.toString(),
        );
      }
    }

    return events.length > 0
      ? this.packs.fromResource(await this.api.getPack(pack.getId().toString()))
      : pack;
  }

  public async search(ownerId?: StickerOwnerId): Promise<StickerPack[]> {
    const resources = await this.api.listPacks({
      ownerIdentityId: ownerId?.toString(),
    });

    return resources.map((resource) => this.packs.fromResource(resource));
  }
}
