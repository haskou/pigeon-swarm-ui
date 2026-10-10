import type { ContactKeyCheck } from '../../domain/ContactPins';

/**
 * How the create-conversation flow reacts to a contact check. Only a handle that
 * was verified before and now resolves to a different identity blocks submission.
 */
export type ContactKeyNotice = 'none' | 'unverified-change' | 'verified-change';

export function contactKeyNotice(
  check: ContactKeyCheck | null | undefined,
): ContactKeyNotice {
  if (check?.status !== 'changed') return 'none';

  return check.verified ? 'verified-change' : 'unverified-change';
}

export function contactKeyBlocked(
  check: ContactKeyCheck | null | undefined,
  acknowledged: boolean,
): boolean {
  return contactKeyNotice(check) === 'verified-change' && !acknowledged;
}
