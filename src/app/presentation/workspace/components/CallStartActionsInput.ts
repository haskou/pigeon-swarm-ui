import type { Dispatch, SetStateAction } from 'react';

import type { CallIceServerResource as CallIceServerConfig } from '../../../../contexts/calls/infrastructure/http/resources/CallIceServerResource';
import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallMicrophoneRequest } from '../../../../contexts/calls/presentation/hooks/CallMicrophoneRequest';
import type { StartCallInput } from '../../../../contexts/calls/presentation/hooks/useCallSession';
import type { CallSession } from '../../../../contexts/calls/presentation/view-models/CallSession';
import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { WorkspaceCallDetails } from './resolveWorkspaceCallDetails';
import type { WorkspaceCallMediaEncryption } from './resolveWorkspaceCallMediaEncryption';
import type { SignalSender } from './SignalSender';
import type { IncomingWorkspaceCall } from './useCallResourceReconciliation';

export type CallStartActionsInput = {
  activeCall: CallSession | null;
  activeCommunity: Community | null;
  callDetailsForResource: (call: CallResource) => WorkspaceCallDetails;
  callMediaEncryptionForResource: (
    call: CallResource,
  ) => Promise<WorkspaceCallMediaEncryption>;
  callNoiseCancellationEnabled: boolean;
  callSignalSender: (callId: string) => SignalSender;
  cleanupJoinedCalls: (exceptCallId?: string) => Promise<void>;
  incomingCall: IncomingWorkspaceCall | null;
  leaveCurrentCallForSwitch: () => Promise<void>;
  loadCallIceConfig: () => Promise<CallIceServerConfig>;
  requestOptionalLocalAudio: (
    event: string,
    context: Record<string, unknown>,
  ) => Promise<CallMicrophoneRequest>;
  session: Session;
  setIncomingCall: Dispatch<SetStateAction<IncomingWorkspaceCall | null>>;
  setSendError: Dispatch<SetStateAction<string | null>>;
  startCall: (input: StartCallInput) => Promise<void>;
  stopLocalAudio: (stream: MediaStream | null) => void;
};
