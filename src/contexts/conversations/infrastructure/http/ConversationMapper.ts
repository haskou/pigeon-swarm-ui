import type { PrimitiveOf } from '@haskou/value-objects';

import type { ConversationResource } from './ConversationResource';

import { Conversation } from '../../domain/Conversation';

const CONVERSATION_TYPES = ['group', 'one-to-one'];

const INVALID_RULES: [string, (value: unknown) => boolean][] = [
  [
    'adminIds',
    (value) =>
      Array.isArray(value) && value.every((id) => typeof id === 'string'),
  ],
  [
    'creatorId',
    (value) => value === undefined || typeof value === 'string',
  ],
  ['id', (value) => typeof value === 'string' && value !== ''],
  ['networkId', (value) => typeof value === 'string'],
  [
    'participantIds',
    (value) =>
      Array.isArray(value) && value.every((id) => typeof id === 'string'),
  ],
  ['type', (value) => CONVERSATION_TYPES.includes(value as string)],
  ['unreadCount', (value) => typeof value === 'number'],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class ConversationMapper {
  public list(value: unknown): ConversationResource[] {
    if (!isRecord(value) || !Array.isArray(value.conversations)) {
      throw new TypeError(
        'Conversations response requires a conversations list.',
      );
    }

    return value.conversations.map((item) => this.resource(item));
  }

  public resource(value: unknown): ConversationResource {
    if (!isRecord(value)) {
      throw new TypeError('Conversation resource must be an object.');
    }

    const { name } = value;
    const invalid = INVALID_RULES.find(
      ([field, valid]) => !valid(value[field]),
    );

    if (invalid) {
      throw new TypeError(`Conversation resource ${invalid[0]} is invalid.`);
    }

    if (name !== undefined && typeof name !== 'string') {
      throw new TypeError('Conversation resource name must be a string.');
    }

    return value as ConversationResource;
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
      unreadCount: primitives.unreadCount,
    };
  }
}
