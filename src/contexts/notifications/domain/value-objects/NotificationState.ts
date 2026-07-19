import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

import type { NotificationDecision } from './NotificationDecision';

const values = ['accepted', 'declined', 'pending'] as const;

export class NotificationState extends Enum<(typeof values)[number]> {
  public static readonly ACCEPTED = new NotificationState('accepted');

  public static readonly DECLINED = new NotificationState('declined');

  public static readonly PENDING = new NotificationState('pending');

  public static fromDecision(
    decision: NotificationDecision,
  ): NotificationState {
    return decision.isAccepted()
      ? NotificationState.ACCEPTED
      : NotificationState.DECLINED;
  }

  public static fromPrimitives(value: string): NotificationState {
    const state = values.find((candidate) => candidate === value);

    if (!state) throw new ValueNotInEnumError(value, values);

    return new NotificationState(state);
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }

  public isPending(): boolean {
    return this.isEqual(NotificationState.PENDING);
  }
}
