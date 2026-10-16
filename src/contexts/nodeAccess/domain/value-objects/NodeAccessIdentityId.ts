import { StringValueObject, assert } from '@haskou/value-objects';

import { InvalidNodeAccessIdentityIdError } from '../errors/InvalidNodeAccessIdentityIdError';

const pemHeader = /-----BEGIN\s+PUBLIC\s+KEY-----/g;
const pemFooter = /-----END\s+PUBLIC\s+KEY-----/g;
const base64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * An identity id in the canonical form nodes sign and compare: the public key
 * base64 without PEM armour or whitespace.
 */
export class NodeAccessIdentityId extends StringValueObject {
  public static fromString(value: string): NodeAccessIdentityId {
    const canonical = value
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');

    assert(base64.test(canonical), new InvalidNodeAccessIdentityIdError());

    return new NodeAccessIdentityId(canonical);
  }

  private constructor(value: string) {
    super(value);
  }
}
