import type { Timestamp } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';

import { AttachmentId } from '../value-objects/AttachmentId';

export class AttachmentPublicationWasPlanned implements DomainEvent {
  public readonly aggregateId: string;

  public readonly occurredAt: number;

  public readonly type = AttachmentPublicationWasPlanned.name;

  public constructor(id: AttachmentId, occurredAt: Timestamp) {
    this.aggregateId = id.toString();
    this.occurredAt = occurredAt.valueOf();
  }
}
