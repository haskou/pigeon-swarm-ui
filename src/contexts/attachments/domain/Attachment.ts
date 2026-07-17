import {
  NullObject,
  Timestamp,
  assert,
  type PrimitiveOf,
} from '@haskou/value-objects';

import type { PublicationStrategy } from './strategies/PublicationStrategy';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { AttachmentAlreadyPublishedError } from './errors/AttachmentAlreadyPublishedError';
import { AttachmentNotPublishedError } from './errors/AttachmentNotPublishedError';
import { AttachmentPublicationWasPlanned } from './events/AttachmentPublicationWasPlanned';
import { AttachmentWasPublished } from './events/AttachmentWasPublished';
import { EncryptedAttachmentStrategy } from './strategies/EncryptedAttachmentStrategy';
import { PublicAttachmentStrategy } from './strategies/PublicAttachmentStrategy';
import { AttachmentByteSize } from './value-objects/AttachmentByteSize';
import { AttachmentContentType } from './value-objects/AttachmentContentType';
import { AttachmentExternalIdentifier } from './value-objects/AttachmentExternalIdentifier';
import { AttachmentFilename } from './value-objects/AttachmentFilename';
import { AttachmentId } from './value-objects/AttachmentId';
import { AttachmentNetworkId } from './value-objects/AttachmentNetworkId';
import { AttachmentPublicationStatus } from './value-objects/AttachmentPublicationStatus';

export class Attachment extends AggregateRoot {
  public static planPublication(
    id: AttachmentId,
    filename: AttachmentFilename,
    contentType: AttachmentContentType,
    size: AttachmentByteSize,
    publication: PublicationStrategy,
    occurredAt: Timestamp,
  ): Attachment {
    const attachment = new Attachment(
      id,
      filename,
      contentType,
      size,
      publication,
      AttachmentPublicationStatus.PLANNED,
      NullObject.new(AttachmentExternalIdentifier),
    );

    attachment.record(new AttachmentPublicationWasPlanned(id, occurredAt));

    return attachment;
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<Attachment>,
  ): Attachment {
    const publication = primitives.publication.encrypted
      ? primitives.publication.networkId
        ? EncryptedAttachmentStrategy.forNetwork(
            AttachmentNetworkId.fromString(primitives.publication.networkId),
          )
        : EncryptedAttachmentStrategy.restore()
      : PublicAttachmentStrategy.create();
    const status = AttachmentPublicationStatus.fromPrimitives(
      primitives.status,
    );
    const externalIdentifier = status.isPublished()
      ? AttachmentExternalIdentifier.fromString(
          primitives.externalIdentifier ?? '',
        )
      : NullObject.new(AttachmentExternalIdentifier);

    return new Attachment(
      AttachmentId.fromString(primitives.id),
      AttachmentFilename.fromString(primitives.filename),
      AttachmentContentType.fromString(primitives.contentType),
      AttachmentByteSize.fromBytes(primitives.size),
      publication,
      status,
      externalIdentifier,
    );
  }

  private constructor(
    private readonly id: AttachmentId,
    private readonly filename: AttachmentFilename,
    private readonly contentType: AttachmentContentType,
    private readonly size: AttachmentByteSize,
    private readonly publication: PublicationStrategy,
    private status: AttachmentPublicationStatus,
    private externalIdentifier: AttachmentExternalIdentifier,
  ) {
    super();
  }

  private publicationPrimitives():
    | { encrypted: false }
    | { encrypted: true; networkId?: string } {
    if (!this.publication.isEncrypted()) return { encrypted: false };

    if (!this.publication.hasEncryptionNetwork()) return { encrypted: true };

    return {
      encrypted: true,
      networkId: this.publication.getEncryptionNetworkId().toString(),
    };
  }

  public getPublishedExternalIdentifier(): AttachmentExternalIdentifier {
    assert(this.isPublished(), new AttachmentNotPublishedError());

    return this.externalIdentifier;
  }

  public getEncryptionNetworkId(): AttachmentNetworkId {
    return this.publication.getEncryptionNetworkId();
  }

  public isEncrypted(): boolean {
    return this.publication.isEncrypted();
  }

  public isPublished(): boolean {
    return this.status.isPublished();
  }

  public publish(
    externalIdentifier: AttachmentExternalIdentifier,
    occurredAt: Timestamp,
  ): void {
    assert(!this.isPublished(), new AttachmentAlreadyPublishedError());

    this.externalIdentifier = externalIdentifier;
    this.status = AttachmentPublicationStatus.PUBLISHED;
    this.record(new AttachmentWasPublished(this.id, occurredAt));
  }

  public toPrimitives() {
    const primitives: {
      contentType: string;
      externalIdentifier?: string;
      filename: string;
      id: string;
      publication:
        | { encrypted: false }
        | { encrypted: true; networkId?: string };
      size: number;
      status: ReturnType<AttachmentPublicationStatus['valueOf']>;
    } = {
      contentType: this.contentType.toString(),
      filename: this.filename.toString(),
      id: this.id.toString(),
      publication: this.publicationPrimitives(),
      size: this.size.valueOf(),
      status: this.status.valueOf(),
    };

    if (this.isPublished()) {
      primitives.externalIdentifier = this.externalIdentifier.toString();
    }

    return primitives;
  }
}
