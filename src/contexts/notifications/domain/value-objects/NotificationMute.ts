import { Timestamp } from '@haskou/value-objects';

export class NotificationMute {
  public static fromPrimitives(value?: number | null): NotificationMute {
    return new NotificationMute(
      typeof value === 'number' ? new Timestamp(value) : value,
    );
  }

  private constructor(private readonly until?: Timestamp | null) {}

  public isActive(now: Timestamp): boolean {
    return this.until === null || Boolean(this.until?.isAfter(now));
  }

  public toPrimitives(): number | null | undefined {
    return this.until instanceof Timestamp ? this.until.valueOf() : this.until;
  }
}
