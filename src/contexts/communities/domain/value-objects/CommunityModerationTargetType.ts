import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const values = [
  'channel',
  'community',
  'invite',
  'member',
  'membership_request',
  'message',
  'role',
] as const;

export class CommunityModerationTargetType extends Enum<
  (typeof values)[number]
> {
  public static fromPrimitives(value: string): CommunityModerationTargetType {
    const type = values.find((candidate) => candidate === value);

    if (!type) throw new ValueNotInEnumError(value, values);

    return new CommunityModerationTargetType(type);
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }

  public toPrimitives() {
    return this.valueOf();
  }
}
