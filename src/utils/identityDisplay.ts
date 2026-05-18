import type { IdentityResource } from '../domain/types';

import {
  isValidHandle as isValidCredentialHandle,
  normalizeHandleInput,
} from './credentialsValidation';
import { shortId } from './formatting';

export type IdentityNames = Record<string, string>;
export type IdentityPictures = Record<string, string>;

export function normalizeHandle(value: string): string {
  return normalizeHandleInput(value);
}

export function isValidHandle(value: string): boolean {
  return isValidCredentialHandle(value);
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

  return picture ? profilePictureUrl(picture) : null;
}

export function identityBanner(identity: IdentityResource): string | null {
  const banner = identity.profile.banner?.trim();

  return banner ? profilePictureUrl(banner) : null;
}

export function profilePictureUrl(value: string): string | null {
  const picture = value.trim();

  return isDirectProfilePictureUrl(picture) ? picture : null;
}

export function isDirectProfilePictureUrl(value: string): boolean {
  return (
    value.startsWith('data:') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/')
  );
}

export function profilePictureDataUrl(input: {
  contentType: string;
  data: string;
}): string {
  return `data:${input.contentType};base64,${input.data}`;
}

const publicFileObjectUrls = new WeakMap<Blob, string>();

export function publicFileObjectUrl(input: { blob: Blob }): string {
  const cached = publicFileObjectUrls.get(input.blob);

  if (cached) return cached;

  const url = URL.createObjectURL(input.blob);

  publicFileObjectUrls.set(input.blob, url);

  return url;
}
