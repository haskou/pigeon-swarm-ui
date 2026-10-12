import type { Dispatch, SetStateAction } from 'react';

import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallSession } from '../../../../contexts/calls/presentation/view-models/CallSession';
import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
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
