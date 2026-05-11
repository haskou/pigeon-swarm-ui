import type { IdentityResource } from '../domain/types';

import { shortId } from './formatting';

export type IdentityNames = Record<string, string>;
export type IdentityPictures = Record<string, string>;

export function normalizeHandle(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export function isValidHandle(value: string): boolean {
  const handle = normalizeHandle(value);

  return /^[a-z0-9_]{3,32}$/.test(handle);
}

export function identityDisplayName(
  identityId: string,
  identityNames: IdentityNames,
): string {
  return identityNames[identityId] ?? shortId(identityId);
}

export function identityName(identity: IdentityResource): string | null {
  const name = identity.profile.name.trim();
  const handle = identity.profile.handle?.trim();

  if (!name && !handle) return null;

  if (name && handle) return `${name} (@${handle})`;

  return name || `@${handle}`;
}

export function identityPicture(identity: IdentityResource): string | null {
  const picture = identity.profile.picture?.trim();

  return picture ? picture : null;
}
