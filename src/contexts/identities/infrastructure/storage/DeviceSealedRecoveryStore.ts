import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';

const storagePrefix = 'pigeon-swarm:device-sealed-recovery:v1';

/**
 * Device-sealed steps left pending by a failed step. Every secret is sealed
 * under the master key before it reaches this store, so recovery needs no
 * root to be open.
 */
export type PendingDeviceSealedRecovery = {
  keychainRewrap?: string;
  rootReseal?: { authorizationRevision: number; rootKey: string };
};

function parseRootReseal(
  value: unknown,
): PendingDeviceSealedRecovery['rootReseal'] {
  if (typeof value !== 'object' || value === null) return undefined;

  const { authorizationRevision, rootKey } = value as Record<string, unknown>;

  return typeof authorizationRevision === 'number' &&
    Number.isInteger(authorizationRevision) &&
    authorizationRevision >= 0 &&
    typeof rootKey === 'string' &&
    rootKey
    ? { authorizationRevision, rootKey }
    : undefined;
}

function parseRecord(raw: string | null): Record<string, unknown> {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);

    return typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parsePending(raw: string | null): PendingDeviceSealedRecovery {
  const { keychainRewrap, rootReseal } = parseRecord(raw);
  const pending: PendingDeviceSealedRecovery = {};

  if (typeof keychainRewrap === 'string' && keychainRewrap) {
    pending.keychainRewrap = keychainRewrap;
  }

  const parsedRootReseal = parseRootReseal(rootReseal);

  if (parsedRootReseal) pending.rootReseal = parsedRootReseal;

  return pending;
}

/**
 * Keeps pending device-sealed recovery steps per local identity on this device.
 * Reads never throw: unreadable data counts as nothing pending. Writes throw
 * when the browser refuses them, so a step that must be recorded first fails
 * closed. An empty record removes the entry.
 */
export class DeviceSealedRecoveryStore {
  public constructor(
    private readonly storage: Pick<
      Storage,
      'getItem' | 'removeItem' | 'setItem'
    >,
  ) {}

  public read(identityId: string): PendingDeviceSealedRecovery {
    try {
      return parsePending(
        this.storage.getItem(
          scopeClientStorageKey(`${storagePrefix}:${identityId}`),
        ),
      );
    } catch {
      return {};
    }
  }

  public write(identityId: string, pending: PendingDeviceSealedRecovery): void {
    const key = scopeClientStorageKey(`${storagePrefix}:${identityId}`);

    if (!pending.keychainRewrap && !pending.rootReseal) {
      this.storage.removeItem(key);

      return;
    }

    this.storage.setItem(key, JSON.stringify(pending));
  }
}
