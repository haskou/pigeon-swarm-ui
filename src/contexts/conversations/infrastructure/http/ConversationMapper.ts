import type { PrimitiveOf } from '@haskou/value-objects';

import type { ConversationResource } from './ConversationResource';

import { Conversation } from '../../domain/Conversation';
import { ConversationId } from '../../domain/value-objects/ConversationId';

const VALID_FIELDS: Record<string, (value: unknown) => boolean> = {
  id: (value) => typeof value === 'string' && value !== '',
  name: (value) => value === undefined || typeof value === 'string',
  networkId: (value) => typeof value === 'string',
  participantIds: (value) =>
    Array.isArray(value) && value.every((id) => typeof id === 'string'),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class ConversationMapper {
  /**
   * The one-to-one conversations of a node listing. Group conversations
   * live in their MLS groups on the device; a row with a group id, made
   * before they moved there, is dropped.
   */
  public list(value: unknown): ConversationResource[] {
    if (!isRecord(value) || !Array.isArray(value.conversations)) {
      throw new TypeError(
        'Conversations response requires a conversations list.',
      );
    }

    return value.conversations
      .map((item) => this.resource(item))
      .filter(({ id }) => !ConversationId.fromString(id).isGroup());
  }

  /**
   * A node row, which is a one-to-one conversation: its `adminIds`,
   * `creatorId` and `type` are neither read nor required.
   */
  public resource(value: unknown): ConversationResource {
    if (!isRecord(value)) {
      throw new TypeError('Conversation resource must be an object.');
    }

    const invalid = Object.entries(VALID_FIELDS).find(
      ([field, valid]) => !valid(value[field]),
    );

    if (invalid) {
      throw new TypeError(`Conversation resource ${invalid[0]} is invalid.`);
    }

    const row = value as Pick<
      ConversationResource,
      'id' | 'name' | 'networkId' | 'participantIds'
    >;

    return {
      adminIds: [],
      id: row.id,
      name: row.name,
      networkId: row.networkId,
      participantIds: row.participantIds,
      type: 'one-to-one',
    };
  }

  public fromPrimitives(resource: ConversationResource): Conversation {
    return Conversation.fromPrimitives({
      ...resource,
      creatorId: resource.creatorId,
      latestMessageAt: resource.latestMessageAt,
      name: resource.name,
    });
  }

  public toResource(conversation: Conversation): ConversationResource {
    const primitives: PrimitiveOf<Conversation> = conversation.toPrimitives();

    return {
      adminIds: primitives.adminIds,
      creatorId: primitives.creatorId,
      id: primitives.id,
      latestMessageAt: primitives.latestMessageAt,
      name: primitives.name,
      networkId: primitives.networkId,
      participantIds: primitives.participantIds,
      type: primitives.type,
    };
  }
}
