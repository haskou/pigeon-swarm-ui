import { Timestamp } from '@haskou/value-objects';

export class PollExpiration {
  public static at(timestamp: Timestamp): PollExpiration {
    return new PollExpiration(timestamp);
  }

  public static fromPrimitives(value?: null | number): PollExpiration {
    return typeof value === 'number'
      ? PollExpiration.at(new Timestamp(value))
      : PollExpiration.never();
  }

  public static never(): PollExpiration {
    return new PollExpiration();
  }

  private constructor(private readonly timestamp?: Timestamp) {}

  public toPrimitives() {
    return this.timestamp?.valueOf() ?? null;
  }
}
