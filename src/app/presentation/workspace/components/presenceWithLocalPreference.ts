import type { IdentityPresenceResource as IdentityPresence } from '../../../../contexts/identities/infrastructure/http/resources/IdentityPresenceResource';
import type { SelectablePresenceStatusResource as SelectablePresenceStatus } from '../../../../contexts/identities/infrastructure/http/resources/SelectablePresenceStatusResource';

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
