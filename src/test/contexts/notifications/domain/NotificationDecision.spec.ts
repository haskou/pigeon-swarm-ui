import { ValueNotInEnumError } from '@haskou/value-objects';

import { NotificationDecision } from '../../../../contexts/notifications/domain/NotificationDecision';

describe(NotificationDecision.name, () => {
  it('recognizes accepted decisions', () => {
    const decision = NotificationDecision.fromState('accepted');

    expect(decision.isAccepted()).toBe(true);
    expect(decision.isDeclined()).toBe(false);
  });

  it('recognizes declined decisions', () => {
    const decision = NotificationDecision.fromState('declined');

    expect(decision.isDeclined()).toBe(true);
    expect(decision.isAccepted()).toBe(false);
  });

  it('rejects unknown notification decisions', () => {
    expect(() => NotificationDecision.fromState('dismissed')).toThrow(
      ValueNotInEnumError,
    );
  });
});
