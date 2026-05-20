import type {
  MyStickersResource,
  PublicFileUpload,
  Session,
  StickerInput,
  StickerPackInput,
  StickerPackResource,
  StickerResource,
} from '../../../shared/domain/pigeonResources.types';

import { PigeonStickersApi } from '../../../modules/stickers/infrastructure/http/PigeonStickersApi';

export class PigeonStickersGateway {
  public constructor(private readonly stickers: PigeonStickersApi) {}

  public async uploadAsset(
    session: Session,
    file: File,
  ): Promise<PublicFileUpload> {
    return await this.stickers.uploadAsset(session, file);
  }

  public async listPacks(
    input: {
      ownerIdentityId?: string;
    } = {},
  ): Promise<StickerPackResource[]> {
    return await this.stickers.listPacks(input);
  }

  public async getPack(packId: string): Promise<StickerPackResource> {
    return await this.stickers.getPack(packId);
  }

  public async getMyStickers(session: Session): Promise<MyStickersResource> {
    return await this.stickers.getMyStickers(session);
  }

  public async createPack(
    session: Session,
    input: StickerPackInput,
  ): Promise<StickerPackResource> {
    return await this.stickers.createPack(session, input);
  }

  public async updatePack(
    session: Session,
    packId: string,
    input: Partial<StickerPackInput>,
  ): Promise<StickerPackResource> {
    return await this.stickers.updatePack(session, packId, input);
  }

  public async addSticker(
    session: Session,
    packId: string,
    input: StickerInput,
  ): Promise<StickerResource> {
    return await this.stickers.addSticker(session, packId, input);
  }

  public async updateSticker(
    session: Session,
    packId: string,
    stickerId: string,
    input: StickerInput,
  ): Promise<StickerResource> {
    return await this.stickers.updateSticker(session, packId, stickerId, input);
  }

  public async deleteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.stickers.deleteSticker(session, packId, stickerId);
  }

  public async savePack(session: Session, packId: string): Promise<void> {
    await this.stickers.savePack(session, packId);
  }

  public async unsavePack(session: Session, packId: string): Promise<void> {
    await this.stickers.unsavePack(session, packId);
  }

  public async favoriteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.stickers.favoriteSticker(session, packId, stickerId);
  }

  public async unfavoriteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.stickers.unfavoriteSticker(session, packId, stickerId);
  }

  public async markUsed(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.stickers.markStickerUsed(session, packId, stickerId);
  }
}
