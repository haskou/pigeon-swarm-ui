import { ValueNotInEnumError } from '@haskou/value-objects';

import { NotificationType } from '../../../../contexts/notifications/domain/value-objects/NotificationType';

describe(NotificationType.name, () => {
  it('identifies missed calls as non-actionable notifications', () => {
    expect(NotificationType.fromPrimitives('missed_call').isActionable()).toBe(
      false,
    );
  });

  it('rejects unknown notification types', () => {
    expect(() => NotificationType.fromPrimitives('unknown')).toThrow(
      ValueNotInEnumError,
    );
  });
});
