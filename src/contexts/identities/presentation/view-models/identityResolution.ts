import type { IdentityResource } from '../../infrastructure/http/resources/IdentityResource';

import { identityName, type IdentityNames } from './identityDisplay';

type IdentityLookup = readonly [
  identityId: string,
  identity: IdentityResource | null,
];

/**
 * `names` after a batch of profile reads. A read that failed keeps the name
 * already shown, so an unreachable node never turns contacts into raw ids.
 */
export function resolvedIdentityNames(
  names: IdentityNames,
  resolved: readonly IdentityLookup[],
): IdentityNames {
  const next = { ...names };

  resolved.forEach(([identityId, identity]) => {
    next[identityId] = identity
      ? (identityName(identity) ?? identityId)
      : (names[identityId] ?? identityId);
  });

  return next;
}

/**
 * Ids in use that have no profile yet. Ids whose read already failed wait for
 * the periodic refresh, so an unreachable node is not polled in a loop.
 */
export function identityIdsAwaitingResolution(
  identityIdsInUse: readonly string[],
  profiles: Readonly<Record<string, IdentityResource>>,
  unresolvedIdentityIds: ReadonlySet<string>,
): string[] {
  return identityIdsInUse.filter(
    (identityId) =>
      !profiles[identityId] && !unresolvedIdentityIds.has(identityId),
  );
}

/** The ids still waiting for the periodic refresh after a batch of reads. */
export function unresolvedIdentityIdsAfter(
  unresolvedIdentityIds: ReadonlySet<string>,
  resolved: readonly IdentityLookup[],
): ReadonlySet<string> {
  const next = new Set(unresolvedIdentityIds);

  resolved.forEach(([identityId, identity]) => {
    if (identity) next.delete(identityId);
    else next.add(identityId);
  });

  return next;
}
