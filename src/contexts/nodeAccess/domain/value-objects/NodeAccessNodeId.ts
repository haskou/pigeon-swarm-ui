import { StringValueObject } from '@haskou/value-objects';

export class NodeAccessNodeId extends StringValueObject {
  public static fromString(value: string): NodeAccessNodeId {
    return new NodeAccessNodeId(value);
  }

  private constructor(value: string) {
    super(value);
  }
}
