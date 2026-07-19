import { Timestamp } from '@haskou/value-objects';

import { StickerDimensions } from '../../../domain/StickerDimensions';
import { StickerType } from '../../../domain/StickerType';
import { StickerAssetExternalIdentifier } from '../../../domain/value-objects/StickerAssetExternalIdentifier';
import { StickerByteSize } from '../../../domain/value-objects/StickerByteSize';
import { StickerContentType } from '../../../domain/value-objects/StickerContentType';
import { StickerOwnerId } from '../../../domain/value-objects/StickerOwnerId';
import { StickerPackId } from '../../../domain/value-objects/StickerPackId';

export class AddStickerToPackMessage {
  public constructor(
    private readonly input: {
      actorIdentityId: string;
      assetExternalIdentifier: string;
      contentType: string;
      height: number;
      occurredAt: number;
      packId: string;
      sizeBytes: number;
      type: string;
      width: number;
    },
  ) {}

  public getActorId(): StickerOwnerId {
    return StickerOwnerId.fromString(this.input.actorIdentityId);
  }

  public getAssetExternalIdentifier(): StickerAssetExternalIdentifier {
    return StickerAssetExternalIdentifier.fromString(
      this.input.assetExternalIdentifier,
    );
  }

  public getContentType(): StickerContentType {
    return StickerContentType.fromString(this.input.contentType);
  }

  public getDimensions(): StickerDimensions {
    return StickerDimensions.create(this.input.width, this.input.height);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.input.occurredAt);
  }

  public getPackId(): StickerPackId {
    return StickerPackId.fromString(this.input.packId);
  }

  public getSize(): StickerByteSize {
    return new StickerByteSize(this.input.sizeBytes);
  }

  public getType(): StickerType {
    return StickerType.fromPrimitives(this.input.type);
  }
}
