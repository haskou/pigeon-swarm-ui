import type { Dispatch, SetStateAction } from 'react';

import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallSession } from '../../../../contexts/calls/presentation/view-models/CallSession';
import type {
  Community,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { WorkspaceCallDetails } from './resolveWorkspaceCallDetails';
import type { IncomingWorkspaceCall } from './useCallResourceReconciliation';

export type CallDepartureInput = {
  activeCall: CallSession | null;
  callDetailsForResource: (call: CallResource) => WorkspaceCallDetails;
  endCall: () => void;
  incomingCall: IncomingWorkspaceCall | null;
  listCalls: () => Promise<CallResource[]>;
  onCommunitiesReload: () => Promise<void>;
  reconcileCallResource: (call: CallResource) => void;
  session: Session;
  setCommunities: Dispatch<SetStateAction<Community[]>>;
};
