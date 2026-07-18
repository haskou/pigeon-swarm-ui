import { ValueObject } from '@haskou/value-objects';

export class PollMultipleVotePermission extends ValueObject<boolean> {
  public static fromBoolean(value: boolean): PollMultipleVotePermission {
    return new PollMultipleVotePermission(value);
  }

  private constructor(value: boolean) {
    super(value);
  }

  public allows(optionCount: number): boolean {
    return (
      this.isEqual(PollMultipleVotePermission.fromBoolean(true)) ||
      optionCount <= 1
    );
  }
}
