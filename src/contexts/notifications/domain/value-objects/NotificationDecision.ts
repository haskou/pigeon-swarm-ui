import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const values = ['accepted', 'declined'] as const;

export class NotificationDecision extends Enum<(typeof values)[number]> {
  public static readonly ACCEPTED = new NotificationDecision('accepted');

  public static readonly DECLINED = new NotificationDecision('declined');

  public static fromPrimitives(value: string): NotificationDecision {
    const decision = values.find((candidate) => candidate === value);

    if (!decision) throw new ValueNotInEnumError(value, values);

    return new NotificationDecision(decision);
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }

  public isAccepted(): boolean {
    return this.isEqual(NotificationDecision.ACCEPTED);
  }

  public isDeclined(): boolean {
    return this.isEqual(NotificationDecision.DECLINED);
  }
}
