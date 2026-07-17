import { ValueNotInEnumError } from '@haskou/value-objects';

import { NotificationType } from '../../../../contexts/notifications/domain/NotificationType';

describe(NotificationType.name, () => {
  it('identifies missed call notifications', () => {
    expect(NotificationType.fromPrimitives('missed_call').isMissedCall()).toBe(
      true,
    );
  });

  it('rejects unknown notification types', () => {
    expect(() => NotificationType.fromPrimitives('unknown')).toThrow(
      ValueNotInEnumError,
    );
  });
});
