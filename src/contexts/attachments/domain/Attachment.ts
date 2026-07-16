import { NullObject, Timestamp, assert } from '@haskou/value-objects';

import type { PublicationStrategy } from './strategies/PublicationStrategy';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { AttachmentAlreadyPublishedError } from './errors/AttachmentAlreadyPublishedError';
import { AttachmentNotPublishedError } from './errors/AttachmentNotPublishedError';
import { AttachmentPublicationWasPlanned } from './events/AttachmentPublicationWasPlanned';
import { AttachmentWasPublished } from './events/AttachmentWasPublished';
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

  public static restorePublished(
    id: AttachmentId,
    filename: AttachmentFilename,
    contentType: AttachmentContentType,
    size: AttachmentByteSize,
    publication: PublicationStrategy,
    externalIdentifier: AttachmentExternalIdentifier,
  ): Attachment {
    return new Attachment(
      id,
      filename,
      contentType,
      size,
      publication,
      AttachmentPublicationStatus.PUBLISHED,
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
}
