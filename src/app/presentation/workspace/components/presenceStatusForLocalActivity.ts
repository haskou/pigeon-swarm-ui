import type {
  IdentityPresence,
  SelectablePresenceStatus,
} from '../../../../shared/domain/pigeonResources.types';

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
