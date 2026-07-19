import { StickerPackId } from '../../../domain/value-objects/StickerPackId';

export class GetStickerPackMessage {
  public constructor(private readonly packId: string) {}

  public getPackId(): StickerPackId {
    return StickerPackId.fromString(this.packId);
  }
}
