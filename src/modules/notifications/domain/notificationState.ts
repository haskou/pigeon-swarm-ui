import { StringValueObject, ValueNotInEnumError } from '@haskou/value-objects';

import type { NotificationDecision } from './notificationDecision';

const acceptedNotificationState = 'accepted';
const declinedNotificationState = 'declined';
const pendingNotificationState = 'pending';

export type NotificationStatePrimitive =
  | typeof acceptedNotificationState
  | typeof declinedNotificationState
  | typeof pendingNotificationState;

export class NotificationState extends StringValueObject {
  private constructor(state: NotificationStatePrimitive) {
    super(state);
  }

  public static accepted(): NotificationState {
    return new NotificationState(acceptedNotificationState);
  }

  public static declined(): NotificationState {
    return new NotificationState(declinedNotificationState);
  }

  public static fromPrimitive(state: string): NotificationState {
    if (!NotificationState.isValidState(state)) {
      throw new ValueNotInEnumError(state, [
        acceptedNotificationState,
        declinedNotificationState,
        pendingNotificationState,
      ]);
    }

    return new NotificationState(state);
  }

  public static pending(): NotificationState {
    return new NotificationState(pendingNotificationState);
  }

  public acceptsDecision(decision: NotificationDecision): boolean {
    return this.isPending() && (decision.isAccepted() || decision.isDeclined());
  }

  public isAccepted(): boolean {
    return this.isEqual(NotificationState.accepted());
  }

  public isDeclined(): boolean {
    return this.isEqual(NotificationState.declined());
  }

  public isPending(): boolean {
    return this.isEqual(NotificationState.pending());
  }

  private static isValidState(
    state: string,
  ): state is NotificationStatePrimitive {
    return (
      state === acceptedNotificationState ||
      state === declinedNotificationState ||
      state === pendingNotificationState
    );
  }
}
