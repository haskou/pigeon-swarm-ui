import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const values = ['leaf', 'reachable', 'relay', 'unknown'] as const;

export class NetworkNodeType extends Enum<(typeof values)[number]> {
  public static fromPrimitives(value: string): NetworkNodeType {
    const nodeType = values.find((candidate) => candidate === value);

    if (!nodeType) throw new ValueNotInEnumError(value, [...values]);

    return new NetworkNodeType(nodeType);
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }

  public isKnown(): boolean {
    return this.isNotEqual(new NetworkNodeType('unknown'));
  }
}
