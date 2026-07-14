const storageKey = 'pigeon-swarm-last-login-identity-v1';

export function loadLastLoginIdentity(): string {
  try {
    return globalThis.localStorage?.getItem(storageKey)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function saveLastLoginIdentity(identityId: string): void {
  const normalizedIdentityId = identityId.trim();

  if (!normalizedIdentityId) return;

  try {
    globalThis.localStorage?.setItem(storageKey, normalizedIdentityId);
  } catch {
    // Remembering the identifier is optional and must not block login.
  }
}
