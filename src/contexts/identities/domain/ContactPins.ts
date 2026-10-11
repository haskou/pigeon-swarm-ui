/**
 * Per-device memory of the contacts a local identity has talked to. Pins are
 * keyed by the peer identity id, the key conversation keys are wrapped to. A
 * handle is only a label: it is remembered to detect when the same name later
 * resolves to a different key, and it never grants verification by itself.
 */
export type ContactPin = {
  handle?: string;
  verifiedAt?: string;
};

export type ContactPins = Record<string, ContactPin>;

export type ContactKeyCheck =
  | { status: 'new' }
  | { status: 'known'; verified: boolean }
  | {
      previousIdentityId: string;
      status: 'changed';
      verified: boolean;
    };

export function normalizeContactHandle(handle?: string): string | undefined {
  const normalized = handle?.trim().replace(/^@/, '').toLowerCase();

  return normalized || undefined;
}

export function checkContactKey(
  pins: ContactPins,
  identityId: string,
  handle?: string,
): ContactKeyCheck {
  const pin = pins[identityId];

  if (pin) return { status: 'known', verified: !!pin.verifiedAt };

  const normalized = normalizeContactHandle(handle);

  if (!normalized) return { status: 'new' };

  const previous = Object.entries(pins).find(
    ([, candidate]) => candidate.handle === normalized,
  );

  if (!previous) return { status: 'new' };

  const [previousIdentityId, previousPin] = previous;

  return {
    previousIdentityId,
    status: 'changed',
    verified: !!previousPin.verifiedAt,
  };
}

export function rememberContact(
  pins: ContactPins,
  identityId: string,
  handle?: string,
): ContactPins {
  const current = pins[identityId];
  const normalized = normalizeContactHandle(handle);

  if (!normalized || current?.handle === normalized) return pins;

  return withPin(pins, identityId, {
    ...current,
    handle: normalized ?? current?.handle,
  });
}

export function verifyContact(
  pins: ContactPins,
  identityId: string,
  verifiedAt: string,
  handle?: string,
): ContactPins {
  const current = pins[identityId];

  return withPin(pins, identityId, {
    handle: normalizeContactHandle(handle) ?? current?.handle,
    verifiedAt,
  });
}

export function unverifyContact(
  pins: ContactPins,
  identityId: string,
): ContactPins {
  const current = pins[identityId];

  if (!current?.verifiedAt) return pins;

  if (!current.handle) {
    const next = { ...pins };

    delete next[identityId];

    return next;
  }

  return withPin(pins, identityId, { handle: current.handle });
}

/**
 * Sets the pin for one identity. A handle belongs to exactly one identity, so
 * the claimed handle is removed from every other pin. Other pins keep their
 * verification even when their handle is released.
 */
function withPin(
  pins: ContactPins,
  identityId: string,
  pin: ContactPin,
): ContactPins {
  const next: ContactPins = {};

  for (const [otherId, other] of Object.entries(pins)) {
    if (otherId === identityId) continue;

    if (pin.handle && other.handle === pin.handle) {
      if (other.verifiedAt) next[otherId] = { verifiedAt: other.verifiedAt };

      continue;
    }

    next[otherId] = other;
  }

  next[identityId] = pin;

  return next;
}
