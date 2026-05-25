export type PendingCommunityInviteLink = {
  inviteSecret?: string;
  token: string;
};

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
  const token = communityInvitePathToken(url);

  if (!token) return null;

  const fragment = window.location.hash.replace(/^#/, '');
  const inviteSecret = new URLSearchParams(fragment)
    .get(inviteSecretFragmentParam)
    ?.trim();

  return {
    ...(inviteSecret ? { inviteSecret } : {}),
    token,
  };
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
