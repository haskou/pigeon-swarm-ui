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
import type { AddStickerToPackPort } from './add-sticker-to-pack/AddStickerToPackPort';
import type { AssetUrlPort } from './asset-url/AssetUrlPort';
import type { CreateStickerPackPort } from './create-sticker-pack/CreateStickerPackPort';
import type { DeleteStickerPort } from './delete-sticker/DeleteStickerPort';
import type { FavoriteStickerPort } from './favorite-sticker/FavoriteStickerPort';
import type { GetMyStickersPort } from './get-my-stickers/GetMyStickersPort';
import type { GetStickerPackPort } from './get-sticker-pack/GetStickerPackPort';
import type { ListStickerPacksPort } from './list-sticker-packs/ListStickerPacksPort';
import type { MarkStickerUsedPort } from './mark-sticker-used/MarkStickerUsedPort';
import type { SaveStickerPackPort } from './save-sticker-pack/SaveStickerPackPort';
import type { UnfavoriteStickerPort } from './unfavorite-sticker/UnfavoriteStickerPort';
import type { UnsaveStickerPackPort } from './unsave-sticker-pack/UnsaveStickerPackPort';
import type { UpdateStickerPackPort } from './update-sticker-pack/UpdateStickerPackPort';
import type { UpdateStickerPort } from './update-sticker/UpdateStickerPort';
import type { UploadStickerAssetPort } from './upload-sticker-asset/UploadStickerAssetPort';

import { ListStickerPacks } from './list-sticker-packs/ListStickerPacks';
import { ListStickerPacksMessage } from './list-sticker-packs/messages/ListStickerPacksMessage';

export class PigeonStickersApplication {
  private readonly listStickerPacks: ListStickerPacks;

  public constructor(
    private readonly dependencies: {
      addStickerToPack: AddStickerToPackPort;
      assetUrl: AssetUrlPort;
      createStickerPack: CreateStickerPackPort;
      deleteSticker: DeleteStickerPort;
      favoriteSticker: FavoriteStickerPort;
      getMyStickers: GetMyStickersPort;
      getStickerPack: GetStickerPackPort;
      listStickerPacks: ListStickerPacksPort;
      markStickerUsed: MarkStickerUsedPort;
      saveStickerPack: SaveStickerPackPort;
      unfavoriteSticker: UnfavoriteStickerPort;
      unsaveStickerPack: UnsaveStickerPackPort;
      updateSticker: UpdateStickerPort;
      updateStickerPack: UpdateStickerPackPort;
      uploadStickerAsset: UploadStickerAssetPort;
    },
  ) {
    this.listStickerPacks = new ListStickerPacks({
      list: async (message) =>
        await dependencies.listStickerPacks.list(message),
    });
  }

  public async addToPack(
    session: Session,
    packId: string,
    input: StickerInput,
  ): Promise<StickerResource> {
    return await this.dependencies.addStickerToPack.addStickerToPack(
      session,
      packId,
      input,
    );
  }

  public assetUrl(assetCid: string): string {
    return this.dependencies.assetUrl.apiUrl(
      `/ipfs/${encodeURIComponent(assetCid)}`,
    );
  }

  public async createPack(
    session: Session,
    input: StickerPackInput,
  ): Promise<StickerPackResource> {
    return await this.dependencies.createStickerPack.createStickerPack(
      session,
      input,
    );
  }

  public async delete(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.dependencies.deleteSticker.deleteSticker(
      session,
      packId,
      stickerId,
    );
  }

  public async favorite(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.dependencies.favoriteSticker.favoriteSticker(
      session,
      packId,
      stickerId,
    );
  }

  public async getMyStickers(session: Session): Promise<MyStickersResource> {
    return await this.dependencies.getMyStickers.getMyStickers(session);
  }

  public async getPack(packId: string): Promise<StickerPackResource> {
    return await this.dependencies.getStickerPack.getStickerPack(packId);
  }

  public async list(
    input: { ownerIdentityId?: string } = {},
  ): Promise<StickerPackResource[]> {
    return await this.listStickerPacks.list(new ListStickerPacksMessage(input));
  }

  public async markUsed(
    session: Session,
    sticker: StickerMessageReference,
  ): Promise<void> {
    await this.dependencies.markStickerUsed.markStickerUsed(
      session,
      sticker.packId,
      sticker.stickerId,
    );
  }

  public async savePack(session: Session, packId: string): Promise<void> {
    await this.dependencies.saveStickerPack.saveStickerPack(session, packId);
  }

  public async unfavorite(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.dependencies.unfavoriteSticker.unfavoriteSticker(
      session,
      packId,
      stickerId,
    );
  }

  public async unsavePack(session: Session, packId: string): Promise<void> {
    await this.dependencies.unsaveStickerPack.unsaveStickerPack(
      session,
      packId,
    );
  }

  public async update(
    session: Session,
    packId: string,
    stickerId: string,
    input: StickerInput,
  ): Promise<StickerResource> {
    return await this.dependencies.updateSticker.updateSticker(
      session,
      packId,
      stickerId,
      input,
    );
  }

  public async updatePack(
    session: Session,
    packId: string,
    input: Partial<StickerPackInput>,
  ): Promise<StickerPackResource> {
    return await this.dependencies.updateStickerPack.updateStickerPack(
      session,
      packId,
      input,
    );
  }

  public async uploadAsset(
    session: Session,
    file: File,
  ): Promise<PublicFileUpload> {
    return await this.dependencies.uploadStickerAsset.uploadStickerAsset(
      session,
      file,
    );
  }
}
