import { Integer, assert } from '@haskou/value-objects';

import { InvalidNodeBlockListVersionError } from '../errors/InvalidNodeBlockListVersionError';

export class NodeBlockListVersion extends Integer {
  public static first(): NodeBlockListVersion {
    return new NodeBlockListVersion(1);
  }

  public static fromNumber(value: number): NodeBlockListVersion {
    assert(
      Number.isSafeInteger(value) && value >= 1,
      new InvalidNodeBlockListVersionError(),
    );

    return new NodeBlockListVersion(value);
  }

  private constructor(value: number) {
    super(value);
  }

  public next(): NodeBlockListVersion {
    return NodeBlockListVersion.fromNumber(this.valueOf() + 1);
  }
}
