import type { CallSignalType } from '../../../../contexts/calls/domain/callSession.types';
import type {
  Community,
  CommunityChannel,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';

export function stringAttribute(
  event: RealtimeDomainEvent,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = event.attributes[key];

    if (typeof value === 'string' && value.length > 0) return value;
  }

  return undefined;
}

export function recordAttribute(
  event: RealtimeDomainEvent,
  key: string,
): Record<string, unknown> | undefined {
  const value = event.attributes[key];

  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function communityChannelAttribute(
  event: RealtimeDomainEvent,
  key: string,
): CommunityChannel | undefined {
  const value = recordAttribute(event, key);

  if (!value) return undefined;

  const { id, name, type } = value;
  const createdAt =
    typeof value.createdAt === 'number' ? value.createdAt : Date.now();

  if (typeof id !== 'string' || typeof name !== 'string') return undefined;

  if (type === 'text') {
    return { createdAt, id, name, type };
  }

  if (type === 'voice') {
    const connectedIdentityIds = Array.isArray(value.connectedIdentityIds)
      ? value.connectedIdentityIds.filter(
          (identityId): identityId is string => typeof identityId === 'string',
        )
      : [];

    return { connectedIdentityIds, createdAt, id, name, type };
  }

  return undefined;
}

export function communityAttribute(
  event: RealtimeDomainEvent,
  key: string,
): Community | undefined {
  const value = recordAttribute(event, key);

  return value &&
    typeof value.id === 'string' &&
    typeof value.networkId === 'string' &&
    typeof value.ownerIdentityId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    Array.isArray(value.memberIds) &&
    Array.isArray(value.textChannels)
    ? (value as Community)
    : undefined;
}

export function callSignalTypeAttribute(
  event: RealtimeDomainEvent,
): CallSignalType | undefined {
  const value = stringAttribute(event, 'signalType');

  return value === 'answer' || value === 'ice_candidate' || value === 'offer'
    ? value
    : undefined;
}

export function eventAggregateId(
  event: RealtimeDomainEvent,
): string | undefined {
  const aggregateId =
    event.aggregate_id ??
    (event as RealtimeDomainEvent & { aggregateId?: string }).aggregateId;

  return typeof aggregateId === 'string' && aggregateId.length > 0
    ? aggregateId
    : undefined;
}
