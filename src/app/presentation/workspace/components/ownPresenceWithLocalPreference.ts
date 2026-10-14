import type { IdentityPresenceResource as IdentityPresence } from '../../../../contexts/identities/infrastructure/http/resources/IdentityPresenceResource';
import type { SelectablePresenceStatusResource as SelectablePresenceStatus } from '../../../../contexts/identities/infrastructure/http/resources/SelectablePresenceStatusResource';

import { IdentityMatch } from '../../../../contexts/identities/domain/IdentityMatch';

/**
 * The own presence with the manual preference kept, or null when the
 * reported presence belongs to another identity, in either id form.
 */
export function ownPresenceWithLocalPreference(
  presence: IdentityPresence,
  currentIdentityId: string,
  preferredStatus: SelectablePresenceStatus | null,
): IdentityPresence | null {
  if (!IdentityMatch.isSame(presence.identityId, currentIdentityId)) {
    return null;
  }

  if (
    !preferredStatus ||
    preferredStatus === 'available' ||
    presence.status === preferredStatus
  ) {
    return presence;
  }

  return { ...presence, status: preferredStatus };
}
