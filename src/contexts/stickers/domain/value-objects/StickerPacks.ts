import { UniqueObjectArray } from '@haskou/value-objects';

import type { StickerPack } from '../StickerPack';
import type { StickerPackId } from './StickerPackId';

export class StickerPacks {
  public static fromArray(packs: StickerPack[]): StickerPacks {
    return new StickerPacks(UniqueObjectArray.fromArray(packs));
  }

  private constructor(private packs: UniqueObjectArray<StickerPack>) {}

  public save(pack: StickerPack): boolean {
    const updated = this.packs.push(pack);
    const saved = updated.length > this.packs.length;

    this.packs = updated;

    return saved;
  }

  public toArray(): StickerPack[] {
    return this.packs.toArray();
  }

  public unsave(packId: StickerPackId): boolean {
    const pack = this.packs
      .toArray()
      .find((candidate) => candidate.belongsTo(packId));

    if (!pack) {
      return false;
    }

    this.packs = this.packs.remove(pack);

    return true;
  }
}
