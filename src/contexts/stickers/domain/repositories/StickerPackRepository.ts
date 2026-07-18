import type { StickerPack } from '../StickerPack';
import type { StickerOwnerId } from '../value-objects/StickerOwnerId';
import type { StickerPackId } from '../value-objects/StickerPackId';

export interface StickerPackRepository {
  create(pack: StickerPack, actorId: StickerOwnerId): Promise<StickerPack>;
  find(packId: StickerPackId): Promise<StickerPack>;
  save(pack: StickerPack, actorId: StickerOwnerId): Promise<StickerPack>;
  search(ownerId?: StickerOwnerId): Promise<StickerPack[]>;
}
