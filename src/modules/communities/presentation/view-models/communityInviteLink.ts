import type { ConversationKeyEntry } from '../../../../shared/domain/pigeonResources.types';

export type PendingCommunityInviteLink = {
  keyEntry?: ConversationKeyEntry;
  token: string;
};

const inviteParam = 'communityInvite';
const keyFragmentPrefix = 'communityKey=';

export function createCommunityInviteUrl(input: {
  keyEntry: ConversationKeyEntry;
  token: string;
}): string {
  const url = new URL(window.location.href);

  url.searchParams.set(inviteParam, input.token);
  url.hash = `${keyFragmentPrefix}${encodeBase64Url(
    JSON.stringify(input.keyEntry),
  )}`;

  return url.toString();
}

export function parseCommunityInviteUrl(): PendingCommunityInviteLink | null {
  const url = new URL(window.location.href);
  const token = url.searchParams.get(inviteParam)?.trim();

  if (!token) return null;

  const fragment = window.location.hash.replace(/^#/, '');
  const keyEntry = fragment.startsWith(keyFragmentPrefix)
    ? parseKeyEntry(fragment.slice(keyFragmentPrefix.length))
    : undefined;

  return { keyEntry, token };
}

export function clearCommunityInviteUrl(): void {
  const url = new URL(window.location.href);

  url.searchParams.delete(inviteParam);
  url.hash = '';
  window.history.replaceState({}, document.title, url.toString());
}

function parseKeyEntry(value: string): ConversationKeyEntry | undefined {
  try {
    return JSON.parse(decodeBase64Url(value)) as ConversationKeyEntry;
  } catch {
    return undefined;
  }
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new TextDecoder().decode(bytes);
}
