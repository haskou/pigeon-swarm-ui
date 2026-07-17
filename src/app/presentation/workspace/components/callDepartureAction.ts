import type { CallSession } from '../../../../contexts/calls/presentation/view-models/CallSession';

export function callDepartureAction(
  kind: CallSession['kind'] | undefined,
): 'end' | 'leave' {
  return kind === 'one-to-one' ? 'end' : 'leave';
}
