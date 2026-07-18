import type { PrimitiveOf } from '@haskou/value-objects';

import { PollOptionId } from '../value-objects/PollOptionId';
import { PollOptionText } from '../value-objects/PollOptionText';

export class PollOption {
  public static fromPrimitives(
    primitives: PrimitiveOf<PollOption>,
  ): PollOption {
    return new PollOption(
      PollOptionId.fromString(primitives.id),
      PollOptionText.fromString(primitives.text),
    );
  }

  public constructor(
    private readonly id: PollOptionId,
    private readonly text: PollOptionText,
  ) {}

  public belongsTo(id: PollOptionId): boolean {
    return this.id.isEqual(id);
  }

  public toPrimitives() {
    return { id: this.id.toString(), text: this.text.toString() };
  }
}
