import type { IdentityPresence, PresenceStatus } from '../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../shared/infrastructure/realtime/realtimeGateway';

export function presenceFromRealtimeEvent(
  event: RealtimeDomainEvent,
): IdentityPresence | null {
  if (event.type !== 'presence.v1.identity_presence.was_updated') return null;

  const attributes = event.attributes;
  const identityId = attributes.identityId;
  const status = attributes.status;

  if (typeof identityId !== 'string' || !isPresenceStatus(status)) return null;

  return {
    identityId,
    status,
    updatedAt:
      typeof attributes.updatedAt === 'number'
        ? attributes.updatedAt
        : Date.now(),
    ...(typeof attributes.lastActivityAt === 'number'
      ? { lastActivityAt: attributes.lastActivityAt }
      : {}),
    ...(typeof attributes.lastHeartbeatAt === 'number'
      ? { lastHeartbeatAt: attributes.lastHeartbeatAt }
      : {}),
    ...(Array.isArray(attributes.networkIds) &&
    attributes.networkIds.every((networkId) => typeof networkId === 'string')
      ? { networkIds: attributes.networkIds }
      : {}),
  };
}

function isPresenceStatus(value: unknown): value is PresenceStatus {
  return (
    value === 'available' ||
    value === 'away' ||
    value === 'busy' ||
    value === 'disconnected' ||
    value === 'invisible'
  );
}
