import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import {
  type ContactPins,
  rememberContact,
  unverifyContact,
  verifyContact,
} from '../../domain/ContactPins';

const storagePrefix = 'pigeon-swarm:contact-pins:v1';

function storageKey(localIdentityId: string): string {
  return scopeClientStorageKey(`${storagePrefix}:${localIdentityId}`);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function parseContactPin(entry: unknown): ContactPins[string] | null {
  if (typeof entry !== 'object' || entry === null) return null;

  const { handle, verifiedAt } = entry as Record<string, unknown>;
  const pin: ContactPins[string] = {};
  const parsedHandle = nonEmptyString(handle);
  const parsedVerifiedAt = nonEmptyString(verifiedAt);

  if (parsedHandle) pin.handle = parsedHandle;

  if (parsedVerifiedAt) pin.verifiedAt = parsedVerifiedAt;

  return parsedHandle || parsedVerifiedAt ? pin : null;
}

function parseContactPins(value: unknown): ContactPins {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  const pins: ContactPins = {};

  for (const [identityId, entry] of Object.entries(value)) {
    const pin = parseContactPin(entry);

    if (pin) pins[identityId] = pin;
  }

  return pins;
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

  private save(localIdentityId: string, pins: ContactPins): void {
    const storage = globalThis.localStorage;

    if (!storage) throw new Error('Browser storage is unavailable.');

    storage.setItem(storageKey(localIdentityId), JSON.stringify(pins));
  }
}
