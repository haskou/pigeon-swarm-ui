import { UniqueObjectArray } from '@haskou/value-objects';

import type { StickerPack } from '../StickerPack';
import type { StickerPackId } from './StickerPackId';

export class StickerPacks {
  public static fromArray(packs: StickerPack[]): StickerPacks {
    return new StickerPacks(UniqueObjectArray.fromArray(packs));
  }

  private constructor(private readonly packs: UniqueObjectArray<StickerPack>) {}

  public save(pack: StickerPack): boolean {
    return this.packs.push(pack);
  }

  public toArray(): StickerPack[] {
    return this.packs.toArray();
  }

  public unsave(packId: StickerPackId): boolean {
    const pack = this.packs
      .toArray()
      .find((candidate) => candidate.belongsTo(packId));

    return pack ? this.packs.remove(pack) : false;
  }
}
