import type { IdentityResource } from '../http/resources/IdentityResource';

export type LocalPasskeyUnlockRecord = {
  createdAt: number;
  encryptedMasterKey: string;
  identityId: string;
  masterKeyDerivation: IdentityResource['masterKeyDerivation'];
  updatedAt: number;
  version: 1;
};

const LOCAL_PASSKEY_UNLOCKS_KEY = 'pigeon-swarm-passkey-unlocks';
const LOCAL_PASSKEY_UNLOCK_VERSION = 1;

function loadRecords(): Record<string, LocalPasskeyUnlockRecord> {
  const serialized = localStorage.getItem(LOCAL_PASSKEY_UNLOCKS_KEY);

  if (!serialized) return {};

  try {
    const parsed = JSON.parse(serialized) as Record<
      string,
      LocalPasskeyUnlockRecord
    >;

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, record]) =>
          record.version === LOCAL_PASSKEY_UNLOCK_VERSION &&
          typeof record.identityId === 'string' &&
          typeof record.encryptedMasterKey === 'string' &&
          !!record.masterKeyDerivation.passkeyPrf,
      ),
    );
  } catch {
    localStorage.removeItem(LOCAL_PASSKEY_UNLOCKS_KEY);

    return {};
  }
}

function saveRecords(records: Record<string, LocalPasskeyUnlockRecord>): void {
  localStorage.setItem(LOCAL_PASSKEY_UNLOCKS_KEY, JSON.stringify(records));
}

export function loadLocalPasskeyUnlock(
  identityId: string,
): LocalPasskeyUnlockRecord | undefined {
  return loadRecords()[identityId];
}

export function saveLocalPasskeyUnlock(
  record: Omit<LocalPasskeyUnlockRecord, 'createdAt' | 'updatedAt' | 'version'>,
): void {
  const records = loadRecords();
  const now = Date.now();

  records[record.identityId] = {
    ...record,
    createdAt: records[record.identityId]?.createdAt ?? now,
    updatedAt: now,
    version: LOCAL_PASSKEY_UNLOCK_VERSION,
  };
  saveRecords(records);
}

export function clearLocalPasskeyUnlock(identityId?: string): void {
  if (!identityId) {
    localStorage.removeItem(LOCAL_PASSKEY_UNLOCKS_KEY);

    return;
  }

  const records = loadRecords();

  delete records[identityId];
  saveRecords(records);
}
