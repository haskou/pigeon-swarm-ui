import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';

import { ConversationEventType } from './ConversationEventType';
import { ConversationId } from './ConversationId';
import { ConversationName } from './ConversationName';
import { ConversationNetworkId } from './ConversationNetworkId';
import { ConversationType } from './ConversationType';

export class ConversationMetadata {
  public static create(
    id: ConversationId,
    networkId: ConversationNetworkId,
    type: ConversationType,
    name: ConversationName,
  ): ConversationMetadata {
    name.assertPresentFor(type);

    return new ConversationMetadata(id, networkId, type, name);
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<ConversationMetadata>,
  ): ConversationMetadata {
    const type = ConversationType.fromPrimitives(primitives.type);
    const name = ConversationName.fromOptional(primitives.name);

    name.assertPresentFor(type);

    return new ConversationMetadata(
      ConversationId.fromString(primitives.id),
      ConversationNetworkId.fromString(primitives.networkId),
      type,
      name,
    );
  }

  private constructor(
    private readonly id: ConversationId,
    private readonly networkId: ConversationNetworkId,
    private readonly type: ConversationType,
    private readonly name: ConversationName,
  ) {}

  public belongsTo(id: ConversationId): boolean {
    return this.id.isEqual(id);
  }

  public identifyEvent(
    type: ConversationEventType,
    occurredAt: Timestamp,
  ): DomainEvent {
    return {
      aggregateId: this.id.toString(),
      occurredAt: occurredAt.valueOf(),
      type: type.valueOf(),
    };
  }

  public isGroup(): boolean {
    return this.type.isGroup() || this.id.isGroup();
  }

  public toPrimitives() {
    return {
      id: this.id.toString(),
      name: this.name.isPresent() ? this.name.toString() : undefined,
      networkId: this.networkId.toString(),
      type: this.type.valueOf(),
    };
  }
}
