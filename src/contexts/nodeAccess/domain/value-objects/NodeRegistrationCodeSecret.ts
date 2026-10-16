import { StringValueObject } from '@haskou/value-objects';

/**
 * The registration code itself. The node returns it once; it only ever goes
 * into the registration link fragment.
 */
export class NodeRegistrationCodeSecret extends StringValueObject {
  public static fromString(value: string): NodeRegistrationCodeSecret {
    return new NodeRegistrationCodeSecret(value);
  }

  private constructor(value: string) {
    super(value);
  }
}
