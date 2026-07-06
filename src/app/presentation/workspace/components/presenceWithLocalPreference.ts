import type {
  IdentityPresence,
  SelectablePresenceStatus,
} from '../../../../shared/domain/pigeonResources.types';

export function presenceWithLocalPreference(
  presence: IdentityPresence,
  currentIdentityId: string,
  preferredStatus: SelectablePresenceStatus | null,
): IdentityPresence {
  if (
    presence.identityId !== currentIdentityId ||
    !preferredStatus ||
    preferredStatus === 'available' ||
    presence.status === preferredStatus
  ) {
    return presence;
  }

  return { ...presence, status: preferredStatus };
}
