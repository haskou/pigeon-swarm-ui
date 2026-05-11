import type { IdentityResource } from '../domain/types';

import { shortId } from './formatting';

export type IdentityNames = Record<string, string>;

export function identityDisplayName(
  identityId: string,
  identityNames: IdentityNames,
): string {
  return identityNames[identityId] ?? shortId(identityId);
}

export function identityName(identity: IdentityResource): string | null {
  const name = identity.profile.name.trim();

  return name.length > 0 ? name : null;
}
