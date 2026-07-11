import type {
  MyStickersResource,
  PublicFileUpload,
  Session,
  StickerInput,
  StickerMessageReference,
  StickerPackInput,
  StickerPackResource,
  StickerResource,
} from '../../shared/domain/pigeonResources.types';

import { ListStickerPacks } from '../../contexts/stickers/application/list-sticker-packs/ListStickerPacks';
import { ListStickerPacksMessage } from '../../contexts/stickers/application/list-sticker-packs/messages/ListStickerPacksMessage';
import { PigeonApiGateway } from './PigeonApiGateway';

export class PigeonStickersApplication {
  private readonly listStickerPacks: ListStickerPacks;

  public constructor(private readonly gateway: PigeonApiGateway) {
    this.listStickerPacks = new ListStickerPacks({
      list: async (message) =>
        await gateway.listStickerPacks({
          ownerIdentityId: message.getOwnerIdentityId(),
        }),
    });
  }

  public async addToPack(
    session: Session,
    packId: string,
    input: StickerInput,
  ): Promise<StickerResource> {
    return await this.gateway.addStickerToPack(session, packId, input);
  }

  public assetUrl(assetCid: string): string {
    return this.gateway.apiUrl(`/ipfs/${encodeURIComponent(assetCid)}`);
  }

  public async createPack(
    session: Session,
    input: StickerPackInput,
  ): Promise<StickerPackResource> {
    return await this.gateway.createStickerPack(session, input);
  }

  public async delete(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.gateway.deleteSticker(session, packId, stickerId);
  }

  public async favorite(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.gateway.favoriteSticker(session, packId, stickerId);
  }

  public async getMyStickers(session: Session): Promise<MyStickersResource> {
    return await this.gateway.getMyStickers(session);
  }

  public async getPack(packId: string): Promise<StickerPackResource> {
    return await this.gateway.getStickerPack(packId);
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
    await this.gateway.markStickerUsed(
      session,
      sticker.packId,
      sticker.stickerId,
    );
  }

  public async savePack(session: Session, packId: string): Promise<void> {
    await this.gateway.saveStickerPack(session, packId);
  }

  public async unfavorite(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.gateway.unfavoriteSticker(session, packId, stickerId);
  }

  public async unsavePack(session: Session, packId: string): Promise<void> {
    await this.gateway.unsaveStickerPack(session, packId);
  }

  public async update(
    session: Session,
    packId: string,
    stickerId: string,
    input: StickerInput,
  ): Promise<StickerResource> {
    return await this.gateway.updateSticker(session, packId, stickerId, input);
  }

  public async updatePack(
    session: Session,
    packId: string,
    input: Partial<StickerPackInput>,
  ): Promise<StickerPackResource> {
    return await this.gateway.updateStickerPack(session, packId, input);
  }

  public async uploadAsset(
    session: Session,
    file: File,
  ): Promise<PublicFileUpload> {
    return await this.gateway.uploadStickerAsset(session, file);
  }
}
