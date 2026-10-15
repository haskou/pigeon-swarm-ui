import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const values = ['open', 'codes', 'closed'] as const;

export type NodeRegistrationModeValue = (typeof values)[number];

/** Who may create identities through this node. */
export class NodeRegistrationMode extends Enum<NodeRegistrationModeValue> {
  public static fromPrimitives(value: string): NodeRegistrationMode {
    const mode = values.find((candidate) => candidate === value);

    if (!mode) throw new ValueNotInEnumError(value, [...values]);

    return new NodeRegistrationMode(mode);
  }

  private constructor(value: NodeRegistrationModeValue) {
    super(value);
  }

  public getValues(): NodeRegistrationModeValue[] {
    return [...values];
  }
}
