import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallSession } from '../../../../contexts/calls/presentation/view-models/CallSession';

import { callDepartureAction } from './callDepartureAction';

export type PageDeparture =
  | { action: 'end'; callId: string }
  | { action: 'leave'; callId: string; declined: boolean };

type PageDepartureInput = {
  activeCall: Pick<CallSession, 'call' | 'id' | 'kind'> | null;
  currentIdentityId: string;
  incomingCall: { call: Pick<CallResource, 'id'> } | null;
};

function isRingingFor(
  call: CallResource | undefined,
  identityId: string,
): boolean {
  return (
    call?.participants.some(
      (participant) =>
        participant.identityId === identityId &&
        participant.status === 'ringing',
    ) ?? false
  );
}

/**
 * Decides what a page departure must sign for the call the page is tracking.
 * The node derives the stored participant state from the call itself, so a
 * ringing participant has to sign a decline: a `left` proof for it is rejected.
 */
export function resolvePageDeparture({
  activeCall,
  currentIdentityId,
  incomingCall,
}: PageDepartureInput): PageDeparture | null {
  if (activeCall) {
    if (isRingingFor(activeCall.call, currentIdentityId)) {
      return { action: 'leave', callId: activeCall.id, declined: true };
    }

    return callDepartureAction(activeCall.kind) === 'end'
      ? { action: 'end', callId: activeCall.id }
      : { action: 'leave', callId: activeCall.id, declined: false };
  }

  return incomingCall
    ? { action: 'leave', callId: incomingCall.call.id, declined: true }
    : null;
}
