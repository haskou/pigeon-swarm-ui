import { ValueNotInEnumError } from '@haskou/value-objects';

import { NotificationDecision } from '../../../../contexts/notifications/domain/value-objects/NotificationDecision';

describe(NotificationDecision.name, () => {
  it('recognizes accepted decisions', () => {
    const decision = NotificationDecision.fromPrimitives('accepted');

    expect(decision.isAccepted()).toBe(true);
    expect(decision.isDeclined()).toBe(false);
  });

  it('recognizes declined decisions', () => {
    const decision = NotificationDecision.fromPrimitives('declined');

    expect(decision.isDeclined()).toBe(true);
    expect(decision.isAccepted()).toBe(false);
  });

  it('rejects unknown notification decisions', () => {
    expect(() => NotificationDecision.fromPrimitives('dismissed')).toThrow(
      ValueNotInEnumError,
    );
  });
});
