import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';

const LEGACY_REMEMBERED_IDENTITY_KEYS = [
  'pigeon-swarm-credentials',
  'pigeon-swarm-identity-preview',
] as const;

/**
 * Removes the localStorage records written by the removed remember-me feature:
 * the saved identity ID and the remembered identity preview. Nothing reads them
 * any more, and the last-login identity record already covers the identity
 * prefill, so upgraded browsers must not keep them. Missing keys are a no-op.
 */
export function deleteLegacyRememberedIdentityStorage(): void {
  for (const key of LEGACY_REMEMBERED_IDENTITY_KEYS)
    localStorage.removeItem(scopeClientStorageKey(key));
}
