import { NullObject, Timestamp } from '@haskou/value-objects';

import { Attachment } from '../../../domain/Attachment';
import { AttachmentUploadStrategy } from '../../../domain/strategies/AttachmentUploadStrategy';
import { AttachmentByteSize } from '../../../domain/value-objects/AttachmentByteSize';
import { AttachmentContentType } from '../../../domain/value-objects/AttachmentContentType';
import { AttachmentEncryptionPreference } from '../../../domain/value-objects/AttachmentEncryptionPreference';
import { AttachmentFilename } from '../../../domain/value-objects/AttachmentFilename';
import { AttachmentId } from '../../../domain/value-objects/AttachmentId';
import { AttachmentNetworkId } from '../../../domain/value-objects/AttachmentNetworkId';
import { AttachmentPublisherExternalIdentifier } from '../../../domain/value-objects/AttachmentPublisherExternalIdentifier';
import { AttachmentSourceExternalIdentifier } from '../../../domain/value-objects/AttachmentSourceExternalIdentifier';

export class PublishMessageAttachmentMessage {
  public constructor(
    private readonly primitives: {
      contentType: string;
      encryptLargeAttachments?: boolean;
      encryptSmallAttachments?: boolean;
      filename: string;
      id: string;
      networkId?: string;
      occurredAt: number;
      publisherExternalIdentifier: string;
      size: number;
      sourceExternalIdentifier: string;
    },
  ) {}

  private getEncryptionPreference(): AttachmentEncryptionPreference {
    const encryptsSmallAttachments =
      this.primitives.encryptSmallAttachments ?? true;
    const encryptsLargeAttachments =
      this.primitives.encryptLargeAttachments ?? false;

    if (encryptsSmallAttachments && encryptsLargeAttachments) {
      return AttachmentEncryptionPreference.ALL;
    }

    if (encryptsLargeAttachments) {
      return AttachmentEncryptionPreference.LARGE_ONLY;
    }

    return encryptsSmallAttachments
      ? AttachmentEncryptionPreference.SMALL_ONLY
      : AttachmentEncryptionPreference.NONE;
  }

  public getAttachment(): Attachment {
    const size = AttachmentByteSize.fromBytes(this.primitives.size);
    const strategy = AttachmentUploadStrategy.define(
      this.getEncryptionPreference(),
      this.primitives.networkId
        ? AttachmentNetworkId.fromString(this.primitives.networkId)
        : NullObject.new(AttachmentNetworkId),
    );

    return Attachment.planPublication(
      AttachmentId.fromString(this.primitives.id),
      AttachmentFilename.fromString(this.primitives.filename),
      AttachmentContentType.fromString(this.primitives.contentType),
      size,
      strategy.publicationFor(size),
      this.getOccurredAt(),
    );
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.primitives.occurredAt);
  }

  public getPublisherIdentifier(): AttachmentPublisherExternalIdentifier {
    return AttachmentPublisherExternalIdentifier.fromString(
      this.primitives.publisherExternalIdentifier,
    );
  }

  public getSourceExternalIdentifier(): AttachmentSourceExternalIdentifier {
    return AttachmentSourceExternalIdentifier.fromString(
      this.primitives.sourceExternalIdentifier,
    );
  }
}
