import { StickerOwnerId } from '../../../domain/value-objects/StickerOwnerId';

export class ListStickerPacksMessage {
  public constructor(
    private readonly input: {
      ownerIdentityId?: string;
    } = {},
  ) {}

  public getOwnerId(): StickerOwnerId | undefined {
    return this.input.ownerIdentityId
      ? StickerOwnerId.fromString(this.input.ownerIdentityId)
      : undefined;
  }
}
