import { ValueObject } from '@haskou/value-objects';

export class NodeCapabilityStatus extends ValueObject<boolean> {
  public static fromBoolean(value: boolean): NodeCapabilityStatus {
    return new NodeCapabilityStatus(value);
  }

  private constructor(value: boolean) {
    super(value);
  }

  public isEnabled(): boolean {
    return this.isEqual(NodeCapabilityStatus.fromBoolean(true));
  }
}
