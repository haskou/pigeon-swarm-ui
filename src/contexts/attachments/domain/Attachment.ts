import { NullObject, Timestamp, assert } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { AttachmentPublicationPlan } from './AttachmentPublicationPlan';
import { AttachmentAlreadyPublishedError } from './errors/AttachmentAlreadyPublishedError';
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
  public static plan(
    id: AttachmentId,
    filename: AttachmentFilename,
    contentType: AttachmentContentType,
    size: AttachmentByteSize,
    publication: AttachmentPublicationPlan,
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

  private constructor(
    private readonly id: AttachmentId,
    private readonly filename: AttachmentFilename,
    private readonly contentType: AttachmentContentType,
    private readonly size: AttachmentByteSize,
    private readonly publication: AttachmentPublicationPlan,
    private status: AttachmentPublicationStatus,
    private externalIdentifier: AttachmentExternalIdentifier,
  ) {
    super();
  }

  public getContentType(): AttachmentContentType {
    return this.contentType;
  }

  public getExternalIdentifier(): AttachmentExternalIdentifier {
    return this.externalIdentifier;
  }

  public getFilename(): AttachmentFilename {
    return this.filename;
  }

  public getId(): AttachmentId {
    return this.id;
  }

  public getNetworkId(): AttachmentNetworkId {
    return this.publication.getEncryptionNetworkId();
  }

  public getSize(): AttachmentByteSize {
    return this.size;
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
