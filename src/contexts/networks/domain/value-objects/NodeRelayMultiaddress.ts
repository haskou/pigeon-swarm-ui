import { assert, StringValueObject } from '@haskou/value-objects';

import { NodeRelayMultiaddressRequiredError } from '../errors/NodeRelayMultiaddressRequiredError';

export class NodeRelayMultiaddress extends StringValueObject {
  public static fromString(value: string): NodeRelayMultiaddress {
    const normalized = value.trim();

    assert(Boolean(normalized), new NodeRelayMultiaddressRequiredError());

    return new NodeRelayMultiaddress(normalized);
  }

  private constructor(value: string) {
    super(value);
  }
}
