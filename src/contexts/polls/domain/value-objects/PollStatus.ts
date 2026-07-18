import { Enum } from '@haskou/value-objects';

enum PollStatusPrimitive {
  CLOSED = 'closed',
  OPEN = 'open',
}

export class PollStatus extends Enum<string> {
  public static readonly CLOSED = new PollStatus(PollStatusPrimitive.CLOSED);

  public static readonly OPEN = new PollStatus(PollStatusPrimitive.OPEN);

  public static closed(): PollStatus {
    return PollStatus.CLOSED;
  }

  public static fromPrimitives(value: string): PollStatus {
    return new PollStatus(value);
  }

  public static open(): PollStatus {
    return PollStatus.OPEN;
  }

  private constructor(value: string) {
    super(value);
  }

  public getValues(): string[] {
    return Object.values(PollStatusPrimitive);
  }

  public isClosed(): boolean {
    return this.isEqual(PollStatus.CLOSED);
  }

  public isOpen(): boolean {
    return this.isEqual(PollStatus.OPEN);
  }
}
