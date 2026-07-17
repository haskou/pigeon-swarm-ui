import type { Timestamp } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';
import type { MessageEventType } from '../value-objects/MessageEventType';
import type { MessageId } from '../value-objects/MessageId';

export abstract class MessageDomainEvent implements DomainEvent {
  public readonly type: string;

  protected constructor(
    private readonly messageId: MessageId,
    private readonly occurredAtTimestamp: Timestamp,
    type: MessageEventType,
  ) {
    this.type = type.valueOf();
  }

  public get aggregateId(): string {
    return this.messageId.toString();
  }

  public get occurredAt(): number {
    return this.occurredAtTimestamp.valueOf();
  }
}
