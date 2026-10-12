import type { IdentityPresenceResource as IdentityPresence } from '../../../contexts/identities/infrastructure/http/resources/IdentityPresenceResource';
import type { PresenceStatusResource as PresenceStatus } from '../../../contexts/identities/infrastructure/http/resources/PresenceStatusResource';
import type { RealtimeDomainEvent } from '../../../shared/infrastructure/realtime/RealtimeGateway';

function isPresenceStatus(value: unknown): value is PresenceStatus {
  return (
    value === 'available' ||
    value === 'away' ||
    value === 'busy' ||
    value === 'disconnected' ||
    value === 'invisible'
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

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
    ...(isStringArray(attributes.networkIds)
      ? { networkIds: attributes.networkIds }
      : {}),
  };
}
