import type { Timestamp } from '@haskou/value-objects';

import type { MessageId } from '../value-objects/MessageId';

import { MessageEventType } from '../value-objects/MessageEventType';
import { MessageDomainEvent } from './MessageDomainEvent';

export class MessagePinned extends MessageDomainEvent {
  public constructor(messageId: MessageId, occurredAt: Timestamp) {
    super(messageId, occurredAt, MessageEventType.PINNED);
  }
}
