import { StringValueObject, ValueNotInEnumError } from '@haskou/value-objects';

const acceptedNotificationDecision = 'accepted';
const declinedNotificationDecision = 'declined';

export type NotificationDecisionState =
  | typeof acceptedNotificationDecision
  | typeof declinedNotificationDecision;

export class NotificationDecision extends StringValueObject {
  private constructor(state: NotificationDecisionState) {
    super(state);
  }

  public static fromState(state: string): NotificationDecision {
    if (!NotificationDecision.isValidState(state)) {
      throw new ValueNotInEnumError(state, [
        acceptedNotificationDecision,
        declinedNotificationDecision,
      ]);
    }

    return new NotificationDecision(state);
  }

  public static accepted(): NotificationDecision {
    return new NotificationDecision(acceptedNotificationDecision);
  }

  public static declined(): NotificationDecision {
    return new NotificationDecision(declinedNotificationDecision);
  }

  public isAccepted(): boolean {
    return this.isEqual(NotificationDecision.accepted());
  }

  public isDeclined(): boolean {
    return this.isEqual(NotificationDecision.declined());
  }

  private static isValidState(
    state: string,
  ): state is NotificationDecisionState {
    return (
      state === acceptedNotificationDecision ||
      state === declinedNotificationDecision
    );
  }
}
