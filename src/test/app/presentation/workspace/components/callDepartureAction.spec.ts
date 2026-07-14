import { callDepartureAction } from '../../../../../app/presentation/workspace/components/callDepartureAction';

describe('callDepartureAction', () => {
  it('ends one-to-one calls for every participant', () => {
    expect(callDepartureAction('one-to-one')).toBe('end');
  });

  it.each(['community-voice', 'group'] as const)(
    'leaves %s calls without ending them for everyone',
    (kind) => {
      expect(callDepartureAction(kind)).toBe('leave');
    },
  );

  it('leaves when no active call kind is available', () => {
    expect(callDepartureAction(undefined)).toBe('leave');
  });
});
