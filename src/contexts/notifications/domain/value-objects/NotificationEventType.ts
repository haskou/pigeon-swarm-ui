import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

import { NotificationDecision } from './NotificationDecision';

const values = ['NotificationAccepted', 'NotificationDeclined'] as const;

export class NotificationEventType extends Enum<(typeof values)[number]> {
  public static readonly ACCEPTED = new NotificationEventType(
    'NotificationAccepted',
  );

  public static readonly DECLINED = new NotificationEventType(
    'NotificationDeclined',
  );

  public static fromPrimitives(value: string): NotificationEventType {
    const type = values.find((candidate) => candidate === value);

    if (!type) throw new ValueNotInEnumError(value, values);

    return new NotificationEventType(type);
  }

  public static fromDecision(
    decision: NotificationDecision,
  ): NotificationEventType {
    return decision.isAccepted()
      ? NotificationEventType.ACCEPTED
      : NotificationEventType.DECLINED;
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }
}
