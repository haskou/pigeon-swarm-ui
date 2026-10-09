export type PendingCommunityInviteLink = {
  token: string;
};

const communityInvitePathPattern = /^\/invite\/community\/([^/]+)\/?$/;

export function createCommunityInviteUrl(input: { token: string }): string {
  const url = new URL(window.location.href);

  url.pathname = `/invite/community/${encodeURIComponent(input.token)}`;
  url.search = '';
  url.hash = '';

  return url.toString();
}

export function parseCommunityInviteUrl(): PendingCommunityInviteLink | null {
  const token = communityInvitePathToken(new URL(window.location.href));

  return token ? { token } : null;
}

export function clearCommunityInviteUrl(): void {
  const url = new URL(window.location.href);

  if (communityInvitePathToken(url)) url.pathname = '/';
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
