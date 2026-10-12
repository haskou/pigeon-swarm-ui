import type { Dispatch, SetStateAction } from 'react';

import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallSession } from '../../../../contexts/calls/presentation/view-models/CallSession';
import type { Community } from '../../../../shared/domain/pigeonResources.types';
import type { WorkspaceCallDetails } from './resolveWorkspaceCallDetails';

export type CallResourceReconciliationInput = {
  activeCall: CallSession | null;
  callDetailsForResource: (call: CallResource) => WorkspaceCallDetails;
  currentIdentityId: string;
  endCall: () => void;
  reconcileCall: (call: CallResource, input: WorkspaceCallDetails) => void;
  setCommunities: Dispatch<SetStateAction<Community[]>>;
};
