import { StringValueObject, assert } from '@haskou/value-objects';

import { InvalidContactPresenceError } from '../errors/InvalidContactPresenceError';

/**
 * The sender's random presence stream for one app session: 16 random bytes
 * as unpadded base64url. It names no device, node or network, and a new one
 * starts every time the app starts.
 */
export class ContactPresenceSource extends StringValueObject {
  private static readonly FORMAT = /^[A-Za-z0-9_-]{22}$/;

  public static fromString(value: string): ContactPresenceSource {
    return new ContactPresenceSource(value);
  }

  private constructor(value: string) {
    super(value);
    assert(
      ContactPresenceSource.FORMAT.test(value),
      new InvalidContactPresenceError(),
    );
  }
}
