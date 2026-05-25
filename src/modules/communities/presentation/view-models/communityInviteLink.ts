import type { ConversationKeyEntry } from '../../../../shared/domain/pigeonResources.types';

export type PendingCommunityInviteLink = {
  inviteSecret?: string;
  keyEntry?: ConversationKeyEntry;
  token: string;
};

const inviteParam = 'communityInvite';
const keyFragmentPrefix = 'communityKey=';
const inviteSecretFragmentParam = 'k';
const communityInvitePathPattern = /^\/invite\/community\/([^/]+)\/?$/;

export function createCommunityInviteUrl(input: {
  inviteSecret: string;
  token: string;
}): string {
  const url = new URL(window.location.href);

  url.pathname = `/invite/community/${encodeURIComponent(input.token)}`;
  url.search = '';
  url.hash = `${inviteSecretFragmentParam}=${input.inviteSecret}`;

  return url.toString();
}

export function parseCommunityInviteUrl(): PendingCommunityInviteLink | null {
  const url = new URL(window.location.href);
  const pathToken = communityInvitePathToken(url);
  const token = pathToken ?? url.searchParams.get(inviteParam)?.trim();

  if (!token) return null;

  const fragment = window.location.hash.replace(/^#/, '');
  const inviteSecret = pathToken
    ? new URLSearchParams(fragment).get(inviteSecretFragmentParam)?.trim()
    : undefined;
  const keyEntry = fragment.startsWith(keyFragmentPrefix)
    ? parseKeyEntry(fragment.slice(keyFragmentPrefix.length))
    : undefined;

  return {
    ...(inviteSecret ? { inviteSecret } : {}),
    ...(keyEntry ? { keyEntry } : {}),
    token,
  };
}

export function clearCommunityInviteUrl(): void {
  const url = new URL(window.location.href);

  if (communityInvitePathToken(url)) url.pathname = '/';
  url.searchParams.delete(inviteParam);
  url.hash = '';
  window.history.replaceState({}, document.title, url.toString());
}

function communityInvitePathToken(url: URL): string | undefined {
  const match = communityInvitePathPattern.exec(url.pathname);
  let value = '';

  try {
    value = match?.[1] ? decodeURIComponent(match[1]).trim() : '';
  } catch {
    return undefined;
  }

  return value || undefined;
}

function parseKeyEntry(value: string): ConversationKeyEntry | undefined {
  try {
    return JSON.parse(decodeBase64Url(value)) as ConversationKeyEntry;
  } catch {
    return undefined;
  }
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
