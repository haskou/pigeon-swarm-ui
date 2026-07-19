import type { DomainEvent } from '../../../../shared/domain/DomainEvent';
import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { StickerLibraryRepository } from '../../domain/repositories/StickerLibraryRepository';
import type { StickerLibrary } from '../../domain/StickerLibrary';
import type { StickerOwnerId } from '../../domain/value-objects/StickerOwnerId';

import { StickerFavorited } from '../../domain/events/StickerFavorited';
import { StickerPackSaved } from '../../domain/events/StickerPackSaved';
import { StickerPackUnsaved } from '../../domain/events/StickerPackUnsaved';
import { StickerUnfavorited } from '../../domain/events/StickerUnfavorited';
import { StickerUsed } from '../../domain/events/StickerUsed';
import { PigeonStickersApi } from './PigeonStickersApi';
import { StickerAccessContexts } from './StickerAccessContexts';
import { StickerLibraryMapper } from './StickerLibraryMapper';

// prettier-ignore
export class PigeonStickerLibraryRepository
  implements StickerLibraryRepository {
  public constructor(
    private readonly api: PigeonStickersApi,
    private readonly contexts: StickerAccessContexts,
    private readonly mapper: StickerLibraryMapper,
  ) {}

  private async persist(event: DomainEvent, session: Session): Promise<void> {
    if (event instanceof StickerPackSaved) {
      await this.api.savePack(session, event.packId.toString());
    }

    if (event instanceof StickerPackUnsaved) {
      await this.api.unsavePack(session, event.packId.toString());
    }

    if (event instanceof StickerFavorited) {
      await this.api.favoriteSticker(
        session,
        event.packId.toString(),
        event.stickerId.toString(),
      );
    }

    if (event instanceof StickerUnfavorited) {
      await this.api.unfavoriteSticker(
        session,
        event.packId.toString(),
        event.stickerId.toString(),
      );
    }

    if (event instanceof StickerUsed) {
      await this.api.markStickerUsed(
        session,
        event.packId.toString(),
        event.stickerId.toString(),
      );
    }
  }

  public async find(ownerId: StickerOwnerId): Promise<StickerLibrary> {
    return this.mapper.fromResource(
      await this.api.getMyStickers(this.contexts.find(ownerId)),
      ownerId,
    );
  }

  public async save(
    library: StickerLibrary,
    ownerId: StickerOwnerId,
  ): Promise<StickerLibrary> {
    const session = this.contexts.find(ownerId);
    const events = library.pullDomainEvents();

    for (const event of events) {
      await this.persist(event, session);
    }

    return events.length > 0
      ? this.mapper.fromResource(await this.api.getMyStickers(session), ownerId)
      : library;
  }
}
