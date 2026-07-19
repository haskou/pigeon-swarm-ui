import { Timestamp, assert, type PrimitiveOf } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { Sticker } from './entities/Sticker';
import { StickerNotFoundError } from './errors/StickerNotFoundError';
import { StickerAdded } from './events/StickerAdded';
import { StickerPackCreated } from './events/StickerPackCreated';
import { StickerPackRenamed } from './events/StickerPackRenamed';
import { StickerRemoved } from './events/StickerRemoved';
import { StickerUpdated } from './events/StickerUpdated';
import { StickerId } from './value-objects/StickerId';
import { StickerOwnerId } from './value-objects/StickerOwnerId';
import { StickerPackId } from './value-objects/StickerPackId';
import { StickerPackName } from './value-objects/StickerPackName';

export class StickerPack extends AggregateRoot {
  public static create(
    ownerId: StickerOwnerId,
    name: StickerPackName,
    occurredAt: Timestamp,
  ): StickerPack {
    const pack = new StickerPack(
      StickerPackId.generate(),
      ownerId,
      name,
      [],
      occurredAt,
      occurredAt,
    );

    pack.record(new StickerPackCreated(pack.id, occurredAt));

    return pack;
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<StickerPack>,
  ): StickerPack {
    return new StickerPack(
      StickerPackId.fromString(primitives.id),
      StickerOwnerId.fromString(primitives.ownerIdentityId),
      StickerPackName.fromString(primitives.name),
      primitives.stickers.map(Sticker.fromPrimitives),
      typeof primitives.createdAt === 'number'
        ? new Timestamp(primitives.createdAt)
        : undefined,
      typeof primitives.updatedAt === 'number'
        ? new Timestamp(primitives.updatedAt)
        : undefined,
    );
  }

  private constructor(
    private readonly id: StickerPackId,
    private readonly ownerIdentityId: StickerOwnerId,
    private name: StickerPackName,
    private stickers: Sticker[],
    private readonly createdAt: Timestamp | undefined,
    private updatedAt: Timestamp | undefined,
  ) {
    super();
  }

  public add(sticker: Sticker, occurredAt: Timestamp): void {
    this.stickers.push(sticker);
    this.updatedAt = occurredAt;
    this.record(new StickerAdded(this.id, sticker.getId(), occurredAt));
  }

  public belongsTo(id: StickerPackId): boolean {
    return this.id.isEqual(id);
  }

  public contains(stickerId: StickerId): boolean {
    return this.stickers.some((sticker) => sticker.belongsTo(stickerId));
  }

  public findSticker(stickerId: StickerId): Sticker {
    const sticker = this.stickers.find((candidate) =>
      candidate.belongsTo(stickerId),
    );

    assert(sticker, new StickerNotFoundError());

    return sticker;
  }

  public getId(): StickerPackId {
    return this.id;
  }

  public ownedBy(ownerId: StickerOwnerId): boolean {
    return this.ownerIdentityId.isEqual(ownerId);
  }

  public remove(stickerId: StickerId, occurredAt: Timestamp): void {
    assert(this.contains(stickerId), new StickerNotFoundError());
    this.stickers = this.stickers.filter(
      (sticker) => !sticker.belongsTo(stickerId),
    );
    this.updatedAt = occurredAt;
    this.record(new StickerRemoved(this.id, stickerId, occurredAt));
  }

  public rename(name: StickerPackName, occurredAt: Timestamp): void {
    if (this.name.isEqual(name)) return;

    this.name = name;
    this.updatedAt = occurredAt;
    this.record(new StickerPackRenamed(this.id, occurredAt));
  }

  public replace(sticker: Sticker, occurredAt: Timestamp): void {
    const stickerId = sticker.getId();

    assert(this.contains(stickerId), new StickerNotFoundError());
    this.stickers = this.stickers.map((candidate) =>
      candidate.belongsTo(stickerId) ? sticker : candidate,
    );
    this.updatedAt = occurredAt;
    this.record(new StickerUpdated(this.id, stickerId, occurredAt));
  }

  public toPrimitives() {
    return {
      createdAt: this.createdAt?.valueOf(),
      id: this.id.toString(),
      name: this.name.toString(),
      ownerIdentityId: this.ownerIdentityId.toString(),
      stickers: this.stickers.map((sticker) => sticker.toPrimitives()),
      updatedAt: this.updatedAt?.valueOf(),
    };
  }
}
