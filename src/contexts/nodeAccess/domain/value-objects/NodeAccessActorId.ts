import { StringValueObject } from '@haskou/value-objects';

/** The signed-in identity acting on this node, usually its node owner. */
export class NodeAccessActorId extends StringValueObject {
  public static fromString(value: string): NodeAccessActorId {
    return new NodeAccessActorId(value.trim());
  }

  private constructor(value: string) {
    super(value);
  }
}
