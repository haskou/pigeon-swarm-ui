import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

import { shortId } from '../../../../shared/presentation/formatting';
import { identityName } from '../../../identities/presentation/view-models/identityDisplay';

export function memberDisplayName(
  identity: IdentityResource | undefined,
  identityId: string,
): string {
  return identity
    ? (identityName(identity) ?? shortId(identity.id))
    : shortId(identityId);
}

export function memberPrimaryName(
  identity: IdentityResource | undefined,
  identityId: string,
): string {
  const name = identity?.profile.name.trim();

  if (name) return name;

  const handle = identity?.profile.handle?.trim();

  return handle ? `@${handle}` : shortId(identityId);
}
