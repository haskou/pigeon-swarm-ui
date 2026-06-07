import { StringValueObject, ValueNotInEnumError } from '@haskou/value-objects';

import type { PollResource } from '../../../../shared/domain/pigeonResources.types';

export class PollStatus extends StringValueObject {
  private static isValid(value: string): value is PollResource['status'] {
    return value === 'closed' || value === 'open';
  }

  public static closed(): PollStatus {
    return new PollStatus('closed');
  }

  public static fromPrimitive(value: string): PollStatus {
    if (!PollStatus.isValid(value)) {
      throw new ValueNotInEnumError(value, ['closed', 'open']);
    }

    return new PollStatus(value);
  }

  public static open(): PollStatus {
    return new PollStatus('open');
  }

  private constructor(value: PollResource['status']) {
    super(value);
  }

  public isClosed(): boolean {
    return this.isEqual(PollStatus.closed());
  }

  public isOpen(): boolean {
    return this.isEqual(PollStatus.open());
  }
}
