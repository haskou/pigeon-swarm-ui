import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import {
  type ContactPins,
  mergeContactPins,
  parseContactPins,
  rememberContact,
  unverifyContact,
  verifyContact,
} from '../../domain/ContactPins';

const storagePrefix = 'pigeon-swarm:contact-pins:v1';

function storageKey(localIdentityId: string): string {
  return scopeClientStorageKey(`${storagePrefix}:${localIdentityId}`);
}

/**
 * Stores contact pins per local identity on this device only. Reads never
 * throw: unreadable data is treated as "no contacts remembered".
 */
export class ContactPinStore {
  public load(localIdentityId: string): ContactPins {
    try {
      const raw = globalThis.localStorage?.getItem(storageKey(localIdentityId));

      return raw ? parseContactPins(JSON.parse(raw)) : {};
    } catch {
      return {};
    }
  }

  /** Records a contact the user has talked to. Saving is best effort. */
  public remember(
    localIdentityId: string,
    identityId: string,
    handle?: string,
  ): ContactPins {
    const current = this.load(localIdentityId);
    const next = rememberContact(current, identityId, handle);

    if (next === current) return current;

    try {
      this.save(localIdentityId, next);
    } catch {
      // Remembering contacts is optional; the conversation flow must not fail.
    }

    return next;
  }

  /** Throws when the browser refuses the write, so the UI can say so. */
  public verify(
    localIdentityId: string,
    identityId: string,
    handle?: string,
    verifiedAt = new Date().toISOString(),
  ): ContactPins {
    const next = verifyContact(
      this.load(localIdentityId),
      identityId,
      verifiedAt,
      handle,
    );

    this.save(localIdentityId, next);

    return next;
  }

  /** Throws when the browser refuses the write, so the UI can say so. */
  public unverify(localIdentityId: string, identityId: string): ContactPins {
    const current = this.load(localIdentityId);
    const next = unverifyContact(current, identityId);

    if (next !== current) this.save(localIdentityId, next);

    return next;
  }

  /**
   * Adds contacts from a backup. Pins already on this device win, and a
   * restored pin never takes a handle held here. Throws when the browser
   * refuses the write, so the UI can say so.
   */
  public restore(localIdentityId: string, restored: ContactPins): void {
    this.save(
      localIdentityId,
      mergeContactPins(this.load(localIdentityId), restored),
    );
  }

  private save(localIdentityId: string, pins: ContactPins): void {
    const storage = globalThis.localStorage;

    if (!storage) throw new Error('Browser storage is unavailable.');

    storage.setItem(storageKey(localIdentityId), JSON.stringify(pins));
  }
}
