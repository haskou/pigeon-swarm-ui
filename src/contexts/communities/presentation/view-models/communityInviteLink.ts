export type PendingCommunityInviteLink = {
  communityId: string;
  secret: string;
};

const INVITE_PATH = '/invite/community';
const STORAGE_KEY = 'pigeon.pendingCommunityInvite';

export function createCommunityInviteUrl(input: PendingCommunityInviteLink): string {
  const url = new URL(window.location.href);
  const fragment = new URLSearchParams({
    c: input.communityId,
    k: input.secret,
  });

  url.pathname = INVITE_PATH;
  url.search = '';
  url.hash = fragment.toString();

  return url.toString();
}

/**
 * Reads the invitation from the link fragment, removes the fragment from the
 * address bar at once and keeps the invitation for this browser session only.
 */
export function parseCommunityInviteUrl(): PendingCommunityInviteLink | null {
  const url = new URL(window.location.href);

  if (url.pathname.replace(/\/$/, '') === INVITE_PATH) {
    const fragment = new URLSearchParams(url.hash.slice(1));
    const communityId = fragment.get('c')?.trim();
    const secret = fragment.get('k')?.trim();

    stripInviteUrl(url);

    if (communityId && secret) {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ communityId, secret }),
      );
    }
  }

  return readStoredInvite();
}

export function clearCommunityInviteUrl(): void {
  window.sessionStorage.removeItem(STORAGE_KEY);
}

function stripInviteUrl(url: URL): void {
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  window.history.replaceState({}, document.title, url.toString());
}

function readStoredInvite(): PendingCommunityInviteLink | null {
  const stored = window.sessionStorage.getItem(STORAGE_KEY);

  if (!stored) return null;

  try {
    const value = JSON.parse(stored) as Partial<PendingCommunityInviteLink>;

    return typeof value.communityId === 'string' &&
      typeof value.secret === 'string'
      ? { communityId: value.communityId, secret: value.secret }
      : null;
  } catch {
    return null;
  }
}
