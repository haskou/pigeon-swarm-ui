import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';

import type { CallParticipantMediaConnectionResource as CallParticipantMediaConnection } from '../../../../contexts/calls/infrastructure/http/resources/CallParticipantMediaConnectionResource';
import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallSignalType } from '../../../../contexts/calls/infrastructure/media/CallSignalType';
import type { CallSession } from '../../../../contexts/calls/presentation/view-models/CallSession';
import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { WorkspaceCalls } from './WorkspaceCalls';

import { logCallDebug } from '../../../../contexts/calls/infrastructure/media/callDebugLogger';
import { useCallMediaAccess } from '../../../../contexts/calls/presentation/hooks/useCallMediaAccess';
import { useCallSession } from '../../../../contexts/calls/presentation/hooks/useCallSession';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { applicationContainer } from '../../../composition/applicationContainer';
import { communitiesWithCallVoicePresence } from './communityVoicePresence';
import { loadWorkspaceCallIceConfig } from './loadWorkspaceCallIceConfig';
import { resolveWorkspaceCallDetails } from './resolveWorkspaceCallDetails';
import { resolveWorkspaceCallMediaEncryption } from './resolveWorkspaceCallMediaEncryption';
import { useCallDeparture } from './useCallDeparture';
import { useCallResourceReconciliation } from './useCallResourceReconciliation';
import { useCallStartActions } from './useCallStartActions';
import { useWorkspaceCallHeartbeat } from './useWorkspaceCallHeartbeat';
import { useWorkspaceRealtimeCallEvents } from './useWorkspaceRealtimeCallEvents';

type WorkspaceCallsInput = {
  activeCommunity: Community | null;
  communities: Community[];
  communityVoiceTopologyKey: string;
  conversations: ConversationResource[];
  identityNames: Record<string, string>;
  identityPictures: Record<string, string>;
  identityProfiles: Record<string, IdentityResource>;
  onCommunitiesChange: Dispatch<SetStateAction<Community[]>>;
  onCommunitiesReload: () => Promise<void>;
  onErrorChange: Dispatch<SetStateAction<string | null>>;
  session: Session;
  sessionRef: RefObject<Session>;
};

function ignoreRejection(): undefined {
  return undefined;
}

function communityVoicePresenceUpdate(calls: CallResource[]) {
  return (current: Community[]) =>
    communitiesWithCallVoicePresence(current, calls);
}

function staleJoinedCallsFor(
  calls: CallResource[],
  identityId: string,
): CallResource[] {
  return calls.filter(
    (call) =>
      call.status === 'active' &&
      call.scope.type === 'community_channel' &&
      call.participants.some(
        (participant) =>
          participant.identityId === identityId && participant.connected,
      ),
  );
}

function leaveCallsIgnoringErrors(
  sessionRef: RefObject<Session>,
  calls: CallResource[],
): Promise<unknown[]> {
  return Promise.all(
    calls.map((call) =>
      applicationContainer.calls
        .leave(sessionRef.current, call.id)
        .catch(ignoreRejection),
    ),
  );
}

export function useWorkspaceCalls({
  activeCommunity,
  communities,
  communityVoiceTopologyKey,
  conversations,
  identityNames,
  identityPictures,
  identityProfiles,
  onCommunitiesChange,
  onCommunitiesReload,
  onErrorChange,
  session,
  sessionRef,
}: WorkspaceCallsInput): WorkspaceCalls {
  const activeCallRef = useRef<CallSession | null>(null);
  const startupSyncIdentityRef = useRef<string | null>(null);
  const callListRequestRef = useRef<Promise<CallResource[]> | null>(null);
  const reconcileCallResourceRef = useRef<(call: CallResource) => void>(
    () => undefined,
  );
  const {
    activeCall,
    callMediaConnections,
    endCall,
    receiveSignal,
    reconcileCall,
    recoverAfterDisruption,
    retryConnection,
    retryMicrophone,
    setParticipantScreenShareVolume,
    setParticipantVolume,
    setScreenShareQuality,
    startCall,
    toggleCamera,
    toggleDeafen,
    toggleMediaEncryption,
    toggleMute,
    toggleNoiseCancellation,
    toggleScreenShare,
  } = useCallSession();
  const {
    mediaEncryptionEnabled,
    noiseCancellationEnabled,
    requestOptionalLocalAudio,
    stopLocalAudio,
    toggleCallMediaEncryption,
    toggleCallNoiseCancellation,
  } = useCallMediaAccess({
    identityId: session.identity.id,
    onError: onErrorChange,
    toggleMediaEncryption,
    toggleNoiseCancellation,
  });

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const listCalls = useCallback(() => {
    const activeRequest = callListRequestRef.current;

    if (activeRequest) return activeRequest;

    const request = applicationContainer.calls
      .list(sessionRef.current)
      .finally(() => {
        if (callListRequestRef.current === request) {
          callListRequestRef.current = null;
        }
      });

    callListRequestRef.current = request;

    return request;
  }, [sessionRef]);

  const callDetailsForResource = useCallback(
    (call: CallResource) =>
      resolveWorkspaceCallDetails({
        call,
        communities,
        conversations,
        currentIdentity: session.identity,
        fallbackLabels: {
          noConversation: copy.chat.noConversation,
          privateCommunity: copy.communities.privateCommunity,
          voiceChannel: copy.calls.voiceChannel,
        },
        identityNames,
        identityPictures,
        identityProfiles,
        keychain: session.keychain,
      }),
    [
      communities,
      conversations,
      identityNames,
      identityPictures,
      identityProfiles,
      session.identity,
      session.keychain,
    ],
  );

  const callMediaEncryptionForResource = useCallback(
    async (call: CallResource) =>
      await resolveWorkspaceCallMediaEncryption({
        call,
        communities,
        communityCallKey: async (communityId, callId) =>
          await applicationContainer.mls.callMediaKey(
            session,
            communityId,
            callId,
          ),
        currentIdentityId: session.identity.id,
        enabled: mediaEncryptionEnabled,
        keychain: session.keychain,
      }),
    [mediaEncryptionEnabled, communities, session],
  );
  const { incomingCall, reconcileCallResource, setIncomingCall } =
    useCallResourceReconciliation({
      activeCall,
      callDetailsForResource,
      currentIdentityId: session.identity.id,
      endCall,
      reconcileCall,
      setCommunities: onCommunitiesChange,
    });
  const { handleRealtimeCallEvent, loadCallSnapshots, recoverRealtimeCalls } =
    useWorkspaceRealtimeCallEvents({
      activeCallRef,
      onRecoveredCalls: (calls, previousActiveCallId) => {
        onCommunitiesChange(communityVoicePresenceUpdate(calls));

        if (
          previousActiveCallId &&
          activeCallRef.current?.id === previousActiveCallId &&
          !calls.some((call) => call.id === previousActiveCallId)
        )
          endCall();
        setIncomingCall((current) =>
          current && !calls.some((call) => call.id === current.call.id)
            ? null
            : current,
        );
      },
      receiveSignal,
      reconcileCallResource,
      sessionRef,
    });

  const recoverRealtimeCallsAfterDisruption = useCallback(() => {
    recoverAfterDisruption();
    recoverRealtimeCalls();
  }, [recoverAfterDisruption, recoverRealtimeCalls]);

  useEffect(() => {
    reconcileCallResourceRef.current = reconcileCallResource;
  }, [reconcileCallResource]);

  const {
    cleanupJoinedCalls,
    leaveActiveCall,
    leaveCurrentCallForSwitch,
    removeCurrentIdentityFromVoicePresence,
  } = useCallDeparture({
    activeCall,
    callDetailsForResource,
    endCall,
    incomingCall,
    listCalls,
    onCommunitiesReload,
    reconcileCallResource,
    session,
    setCommunities: onCommunitiesChange,
  });
  const callSignalSender = useCallback(
    (callId: string) =>
      async (
        recipientIdentityId: string,
        signalType: CallSignalType,
        payload: Record<string, unknown>,
      ) => {
        logCallDebug('workspace:send-call-signal', {
          callId,
          recipientIdentityId,
          signalType,
        });
        await applicationContainer.calls.sendSignal(
          sessionRef.current,
          callId,
          { payload, recipientIdentityId, signalType },
        );
      },
    [sessionRef],
  );
  const loadCallIceConfig = useCallback(
    () =>
      loadWorkspaceCallIceConfig(() =>
        applicationContainer.calls.getIceServers(sessionRef.current),
      ),
    [sessionRef],
  );
  const {
    acceptIncomingCall,
    declineIncomingCall,
    isCallActionInProgress,
    startCommunityVoiceCall,
    startConversationCall,
  } = useCallStartActions({
    activeCall,
    activeCommunity,
    callDetailsForResource,
    callMediaEncryptionForResource,
    callNoiseCancellationEnabled: noiseCancellationEnabled,
    callSignalSender,
    cleanupJoinedCalls,
    incomingCall,
    leaveCurrentCallForSwitch,
    loadCallIceConfig,
    requestOptionalLocalAudio,
    session,
    setIncomingCall,
    setSendError: onErrorChange,
    startCall,
    stopLocalAudio,
  });
  const heartbeatActiveCall = useCallback(
    async (
      callId: string,
      mediaConnections: CallParticipantMediaConnection[],
    ) => {
      await applicationContainer.calls.heartbeatParticipant(
        sessionRef.current,
        callId,
        mediaConnections,
      );
    },
    [sessionRef],
  );

  useWorkspaceCallHeartbeat({
    activeCall,
    heartbeat: heartbeatActiveCall,
    mediaConnections: callMediaConnections,
    onAccessDenied: (callId) => {
      if (activeCallRef.current?.id !== callId) return;

      endCall();
      removeCurrentIdentityFromVoicePresence();
    },
  });

  useEffect(() => {
    if (!communityVoiceTopologyKey) return undefined;

    let cancelled = false;

    void loadCallSnapshots(listCalls)
      .then((calls) => {
        if (!cancelled && calls) {
          onCommunitiesChange(communityVoicePresenceUpdate(calls));
        }
      })
      .catch(ignoreRejection);

    return () => {
      cancelled = true;
    };
  }, [
    communityVoiceTopologyKey,
    listCalls,
    loadCallSnapshots,
    onCommunitiesChange,
  ]);

  useEffect(() => {
    let cancelled = false;
    const identityId = session.identity.id;

    if (startupSyncIdentityRef.current === identityId) return undefined;

    startupSyncIdentityRef.current = identityId;

    void loadCallSnapshots(listCalls)
      .then(async (calls) => {
        if (cancelled || !calls) return;

        const staleJoinedCalls = staleJoinedCallsFor(calls, identityId);

        if (
          staleJoinedCalls.length > 0 &&
          !activeCallRef.current &&
          !isCallActionInProgress()
        ) {
          await leaveCallsIgnoringErrors(sessionRef, staleJoinedCalls);
          removeCurrentIdentityFromVoicePresence();
          await onCommunitiesReload().catch(ignoreRejection);

          return;
        }

        calls.forEach(reconcileCallResourceRef.current);
      })
      .catch(ignoreRejection);

    return () => {
      cancelled = true;
    };
  }, [
    isCallActionInProgress,
    listCalls,
    loadCallSnapshots,
    onCommunitiesReload,
    removeCurrentIdentityFromVoicePresence,
    session.identity.id,
    sessionRef,
  ]);

  return {
    acceptIncomingCall,
    activeCall,
    declineIncomingCall,
    handleRealtimeCallEvent,
    incomingCall,
    leaveActiveCall,
    recoverRealtimeCalls: recoverRealtimeCallsAfterDisruption,
    retryConnection,
    retryMicrophone,
    setParticipantScreenShareVolume,
    setParticipantVolume,
    setScreenShareQuality,
    startCommunityVoiceCall,
    startConversationCall,
    toggleCallMediaEncryption,
    toggleCallNoiseCancellation,
    toggleCamera,
    toggleDeafen,
    toggleMute,
    toggleScreenShare,
  };
}
