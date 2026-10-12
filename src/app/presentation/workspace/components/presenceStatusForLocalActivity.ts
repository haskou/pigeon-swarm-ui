import type { IdentityPresenceResource as IdentityPresence } from '../../../../contexts/identities/infrastructure/http/resources/IdentityPresenceResource';
import type { SelectablePresenceStatusResource as SelectablePresenceStatus } from '../../../../contexts/identities/infrastructure/http/resources/SelectablePresenceStatusResource';

const recoverableActivityStatuses = new Set<IdentityPresence['status']>([
  'away',
  'disconnected',
]);

export function presenceStatusForLocalActivity(input: {
  force?: boolean;
  ownPresence?: IdentityPresence;
  preferredStatus: SelectablePresenceStatus | null;
}): SelectablePresenceStatus | null {
  const preferredStatus = input.preferredStatus ?? 'available';

  if (!input.ownPresence) return preferredStatus;

  if (input.force) return preferredStatus;

  if (input.ownPresence.status === preferredStatus) return null;

  if (preferredStatus !== 'available') return preferredStatus;

  return recoverableActivityStatuses.has(input.ownPresence.status)
    ? preferredStatus
    : null;
}
