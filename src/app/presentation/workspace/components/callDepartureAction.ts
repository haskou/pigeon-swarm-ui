import type { CallSession } from '../../../../contexts/calls/domain/callSession.types';

export function callDepartureAction(
  kind: CallSession['kind'] | undefined,
): 'end' | 'leave' {
  return kind === 'one-to-one' ? 'end' : 'leave';
}
