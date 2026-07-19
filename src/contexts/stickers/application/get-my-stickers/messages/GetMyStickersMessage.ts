import { StickerOwnerId } from '../../../domain/value-objects/StickerOwnerId';

export class GetMyStickersMessage {
  public constructor(private readonly ownerIdentityId: string) {}

  public getOwnerId(): StickerOwnerId {
    return StickerOwnerId.fromString(this.ownerIdentityId);
  }
}
