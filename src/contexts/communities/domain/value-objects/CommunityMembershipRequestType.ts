import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

export class CommunityMembershipRequestType extends Enum<'request'> {
  private static readonly values = ['request'] as const;

  public static fromPrimitives(value: string): CommunityMembershipRequestType {
    const type = CommunityMembershipRequestType.values.find(
      (candidate) => candidate === value,
    );

    if (!type) {
      throw new ValueNotInEnumError(
        value,
        CommunityMembershipRequestType.values,
      );
    }

    return new CommunityMembershipRequestType(type);
  }

  private constructor(
    value: (typeof CommunityMembershipRequestType.values)[number],
  ) {
    super(value);
  }

  public getValues(): Array<
    (typeof CommunityMembershipRequestType.values)[number]
  > {
    return [...CommunityMembershipRequestType.values];
  }

  public toPrimitives() {
    return this.valueOf();
  }
}
