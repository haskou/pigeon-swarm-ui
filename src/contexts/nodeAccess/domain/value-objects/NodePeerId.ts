import { StringValueObject, assert } from '@haskou/value-objects';

import { InvalidNodePeerIdError } from '../errors/InvalidNodePeerIdError';

const pattern = /^[1-9A-HJ-NP-Za-km-z]{46,64}$/;

/** A node's libp2p peer id in its base58btc form, as `GET /peers` shows it. */
export class NodePeerId extends StringValueObject {
  public static fromString(value: string): NodePeerId {
    const trimmed = value.trim();

    assert(pattern.test(trimmed), new InvalidNodePeerIdError());

    return new NodePeerId(trimmed);
  }

  private constructor(value: string) {
    super(value);
  }
}
