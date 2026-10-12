import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallSession } from '../../../../contexts/calls/presentation/view-models/CallSession';

export type PageDepartureInput = {
  activeCall: Pick<CallSession, 'call' | 'id' | 'kind'> | null;
  currentIdentityId: string;
  incomingCall: { call: Pick<CallResource, 'id'> } | null;
};
