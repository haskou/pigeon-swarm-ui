import { Integer, NullObject, assert } from '@haskou/value-objects';

import { NodeRelayPortInvalidError } from '../errors/NodeRelayPortInvalidError';

export class NodeRelayPort extends Integer {
  public static fromNumber(value: number): NodeRelayPort {
    assert(
      Number.isInteger(value) && value >= 1 && value <= 65_535,
      new NodeRelayPortInvalidError(),
    );

    return new NodeRelayPort(value);
  }

  public static fromOptional(value?: number): NodeRelayPort {
    if (value === undefined) return NullObject.new(NodeRelayPort);

    return this.fromNumber(value);
  }

  public constructor(value: number) {
    super(value);
  }

  public isConfigured(): boolean {
    return !NullObject.isNullObject(this);
  }
}
