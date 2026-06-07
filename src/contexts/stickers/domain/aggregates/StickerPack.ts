import type {
  StickerPackResource,
  StickerResource,
} from '../../../../shared/domain/pigeonResources.types';

import { AggregateRoot } from '../../../../shared/domain/AggregateRoot';
import { StickerId } from '../value-objects/StickerId';
import { StickerPackId } from '../value-objects/StickerPackId';
import { StickerPackName } from '../value-objects/StickerPackName';

export class StickerPack extends AggregateRoot {
  public static fromResource(resource: StickerPackResource): StickerPack {
    return new StickerPack(
      StickerPackId.fromString(resource.id),
      StickerPackName.fromString(resource.name),
      resource,
      resource.stickers,
    );
  }

  private constructor(
    private readonly id: StickerPackId,
    private name: StickerPackName,
    private readonly resource: StickerPackResource,
    private stickers: StickerResource[],
  ) {
    super();
  }

  public contains(stickerId: StickerId): boolean {
    return this.stickers.some((sticker) =>
      StickerId.fromString(sticker.id).isEqual(stickerId),
    );
  }

  public getId(): StickerPackId {
    return this.id;
  }

  public getName(): StickerPackName {
    return this.name;
  }

  public rename(name: StickerPackName): void {
    if (this.name.isEqual(name)) return;

    this.name = name;
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: Date.now(),
      type: 'StickerPackRenamed',
    });
  }

  public toResource(): StickerPackResource {
    return {
      ...this.resource,
      name: this.name.toString(),
      stickers: this.stickers,
    };
  }
}
