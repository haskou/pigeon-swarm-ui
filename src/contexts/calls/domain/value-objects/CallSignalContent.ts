import { JsonObject } from '../../../../shared/domain/serialization/JsonObject';

export class CallSignalContent {
  public static fromPrimitives(
    value: Record<string, unknown>,
  ): CallSignalContent {
    return new CallSignalContent(JsonObject.fromPrimitives(value));
  }

  private constructor(private readonly value: JsonObject) {}

  public toPrimitives() {
    return this.value.toPrimitives();
  }
}
