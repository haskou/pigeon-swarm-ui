import type { Timestamp } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';
import type { MessageConversationId } from '../value-objects/MessageConversationId';

import { ConversationDraftEventType } from '../value-objects/ConversationDraftEventType';

export class ConversationDraftSaved implements DomainEvent {
  public readonly type = ConversationDraftEventType.SAVED.valueOf();

  public constructor(
    private readonly conversationId: MessageConversationId,
    private readonly updatedAt: Timestamp,
  ) {}

  public get aggregateId(): string {
    return this.conversationId.toString();
  }

  public get occurredAt(): number {
    return this.updatedAt.valueOf();
  }
}
