import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

export class CommunityMembershipRequestStatus extends Enum<
  'accepted' | 'declined' | 'pending'
> {
  private static readonly values = ['accepted', 'declined', 'pending'] as const;

  public static fromPrimitives(
    value: string,
  ): CommunityMembershipRequestStatus {
    const status = CommunityMembershipRequestStatus.values.find(
      (candidate) => candidate === value,
    );

    if (!status) {
      throw new ValueNotInEnumError(
        value,
        CommunityMembershipRequestStatus.values,
      );
    }

    return new CommunityMembershipRequestStatus(status);
  }

  private constructor(
    value: (typeof CommunityMembershipRequestStatus.values)[number],
  ) {
    super(value);
  }

  public getValues(): Array<
    (typeof CommunityMembershipRequestStatus.values)[number]
  > {
    return [...CommunityMembershipRequestStatus.values];
  }

  public toPrimitives() {
    return this.valueOf();
  }
}
