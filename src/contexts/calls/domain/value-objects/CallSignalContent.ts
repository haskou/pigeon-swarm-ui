import { ValueObject } from '@haskou/value-objects';

export class CallSignalContent extends ValueObject<Record<string, unknown>> {
  public static fromPrimitives(
    value: Record<string, unknown>,
  ): CallSignalContent {
    return new CallSignalContent(value);
  }

  private constructor(value: Record<string, unknown>) {
    super(value);
  }
}
