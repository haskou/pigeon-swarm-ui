import type {
  MyStickersResource,
  PublicFileUpload,
  Session,
  StickerInput,
  StickerMessageReference,
  StickerPackInput,
  StickerPackResource,
  StickerResource,
} from '../../../shared/domain/pigeonResources.types';
import type { StickerUseCases } from './StickerUseCases';

import { AddStickerToPackMessage } from '../../../contexts/stickers/application/add-sticker-to-pack/messages/AddStickerToPackMessage';
import { CreateStickerPackMessage } from '../../../contexts/stickers/application/create-sticker-pack/messages/CreateStickerPackMessage';
import { DeleteStickerMessage } from '../../../contexts/stickers/application/delete-sticker/messages/DeleteStickerMessage';
import { FavoriteStickerMessage } from '../../../contexts/stickers/application/favorite-sticker/messages/FavoriteStickerMessage';
import { GetMyStickersMessage } from '../../../contexts/stickers/application/get-my-stickers/messages/GetMyStickersMessage';
import { GetStickerPackMessage } from '../../../contexts/stickers/application/get-sticker-pack/messages/GetStickerPackMessage';
import { ListStickerPacksMessage } from '../../../contexts/stickers/application/list-sticker-packs/messages/ListStickerPacksMessage';
import { MarkStickerUsedMessage } from '../../../contexts/stickers/application/mark-sticker-used/messages/MarkStickerUsedMessage';
import { SaveStickerPackMessage } from '../../../contexts/stickers/application/save-sticker-pack/messages/SaveStickerPackMessage';
import { UnfavoriteStickerMessage } from '../../../contexts/stickers/application/unfavorite-sticker/messages/UnfavoriteStickerMessage';
import { UnsaveStickerPackMessage } from '../../../contexts/stickers/application/unsave-sticker-pack/messages/UnsaveStickerPackMessage';
import { UpdateStickerPackMessage } from '../../../contexts/stickers/application/update-sticker-pack/messages/UpdateStickerPackMessage';
import { UpdateStickerMessage } from '../../../contexts/stickers/application/update-sticker/messages/UpdateStickerMessage';
import { PigeonStickersApi } from '../../../contexts/stickers/infrastructure/http/PigeonStickersApi';
import { StickerAccessContexts } from '../../../contexts/stickers/infrastructure/http/StickerAccessContexts';
import { StickerLibraryMapper } from '../../../contexts/stickers/infrastructure/http/StickerLibraryMapper';
import { StickerMapper } from '../../../contexts/stickers/infrastructure/http/StickerMapper';
import { StickerPackMapper } from '../../../contexts/stickers/infrastructure/http/StickerPackMapper';
import { StickerProjectionNotFoundError } from './errors/StickerProjectionNotFoundError';

export class PigeonStickersFacade {
  public constructor(
    private readonly api: PigeonStickersApi,
    private readonly apiUrl: (path: string) => string,
    private readonly contexts: StickerAccessContexts,
    private readonly libraries: StickerLibraryMapper,
    private readonly packs: StickerPackMapper,
    private readonly stickers: StickerMapper,
    private readonly useCases: StickerUseCases,
  ) {}

  private actor(session: Session): string {
    this.contexts.register(session);

    return session.identity.id;
  }

  private stickerInput(
    actorIdentityId: string,
    packId: string,
    input: StickerInput,
  ) {
    return {
      actorIdentityId,
      assetExternalIdentifier: input.assetCid,
      contentType: input.contentType,
      height: input.dimensions.height,
      occurredAt: Date.now(),
      packId,
      sizeBytes: input.sizeBytes,
      type: input.type,
      width: input.dimensions.width,
    };
  }

  public async addToPack(
    session: Session,
    packId: string,
    input: StickerInput,
  ): Promise<StickerResource> {
    const sticker = await this.useCases.adder.add(
      new AddStickerToPackMessage(
        this.stickerInput(this.actor(session), packId, input),
      ),
    );

    return this.stickers.toResource(sticker);
  }

  public assetUrl(assetCid: string): string {
    return this.apiUrl(`/ipfs/${encodeURIComponent(assetCid)}`);
  }

  public async createPack(
    session: Session,
    input: StickerPackInput,
  ): Promise<StickerPackResource> {
    return this.packs.toResource(
      await this.useCases.creator.create(
        new CreateStickerPackMessage(
          this.actor(session),
          input.name,
          Date.now(),
        ),
      ),
    );
  }

  public async delete(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.useCases.remover.remove(
      new DeleteStickerMessage(
        this.actor(session),
        packId,
        stickerId,
        Date.now(),
      ),
    );
  }

  public async favorite(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.useCases.favoriter.favorite(
      new FavoriteStickerMessage(
        this.actor(session),
        packId,
        stickerId,
        Date.now(),
      ),
    );
  }

  public async getMyStickers(session: Session): Promise<MyStickersResource> {
    return this.libraries.toResource(
      await this.useCases.libraryFinder.find(
        new GetMyStickersMessage(this.actor(session)),
      ),
    );
  }

  public async getPack(packId: string): Promise<StickerPackResource> {
    return this.packs.toResource(
      await this.useCases.packFinder.find(new GetStickerPackMessage(packId)),
    );
  }

  public async list(
    input: { ownerIdentityId?: string } = {},
  ): Promise<StickerPackResource[]> {
    return (
      await this.useCases.packLister.list(new ListStickerPacksMessage(input))
    ).map((pack) => this.packs.toResource(pack));
  }

  public async markUsed(
    session: Session,
    sticker: StickerMessageReference,
  ): Promise<void> {
    await this.useCases.usageMarker.mark(
      new MarkStickerUsedMessage(
        this.actor(session),
        sticker.packId,
        sticker.stickerId,
        Date.now(),
      ),
    );
  }

  public async savePack(session: Session, packId: string): Promise<void> {
    await this.useCases.packSaver.save(
      new SaveStickerPackMessage(this.actor(session), packId, Date.now()),
    );
  }

  public async unfavorite(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.useCases.unfavoriter.unfavorite(
      new UnfavoriteStickerMessage(
        this.actor(session),
        packId,
        stickerId,
        Date.now(),
      ),
    );
  }

  public async unsavePack(session: Session, packId: string): Promise<void> {
    await this.useCases.packUnsaver.unsave(
      new UnsaveStickerPackMessage(this.actor(session), packId, Date.now()),
    );
  }

  public async update(
    session: Session,
    packId: string,
    stickerId: string,
    input: StickerInput,
  ): Promise<StickerResource> {
    const pack = await this.useCases.updater.update(
      new UpdateStickerMessage({
        ...this.stickerInput(this.actor(session), packId, input),
        stickerId,
      }),
    );
    const resource = this.packs.toResource(pack);
    const sticker = resource.stickers.find(
      (candidate) => candidate.id === stickerId,
    );

    if (!sticker) throw new StickerProjectionNotFoundError();

    return sticker;
  }

  public async updatePack(
    session: Session,
    packId: string,
    input: Partial<StickerPackInput>,
  ): Promise<StickerPackResource> {
    if (!input.name) return await this.getPack(packId);

    return this.packs.toResource(
      await this.useCases.packRenamer.rename(
        new UpdateStickerPackMessage(
          this.actor(session),
          packId,
          input.name,
          Date.now(),
        ),
      ),
    );
  }

  public async uploadAsset(
    session: Session,
    file: File,
  ): Promise<PublicFileUpload> {
    return await this.api.uploadAsset(session, file);
  }
}
