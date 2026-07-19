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
import type {
  Community,
  ConversationResource,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import {
  logCallDebug,
  logCallError,
} from '../../../../contexts/calls/infrastructure/media/callDebugLogger';
import { useCallMediaAccess } from '../../../../contexts/calls/presentation/hooks/useCallMediaAccess';
import { useCallSession } from '../../../../contexts/calls/presentation/hooks/useCallSession';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { applicationContainer } from '../../../composition/applicationContainer';
import { communitiesWithCallVoicePresence } from './communityVoicePresence';
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

type WorkspaceCalls = Pick<
  ReturnType<typeof useCallSession>,
  | 'activeCall'
  | 'retryMicrophone'
  | 'setParticipantScreenShareVolume'
  | 'setParticipantVolume'
  | 'setScreenShareQuality'
  | 'toggleCamera'
  | 'toggleDeafen'
  | 'toggleMute'
  | 'toggleScreenShare'
> &
  Pick<
    ReturnType<typeof useCallMediaAccess>,
    'toggleCallMediaEncryption' | 'toggleCallNoiseCancellation'
  > &
  Pick<
    ReturnType<typeof useCallStartActions>,
    | 'acceptIncomingCall'
    | 'declineIncomingCall'
    | 'startCommunityVoiceCall'
    | 'startConversationCall'
  > &
  Pick<ReturnType<typeof useCallDeparture>, 'leaveActiveCall'> & {
    handleRealtimeCallEvent: (
      event: Parameters<ReturnType<typeof useWorkspaceRealtimeCallEvents>>[0],
    ) => void;
    incomingCall: ReturnType<
      typeof useCallResourceReconciliation
    >['incomingCall'];
  };

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
    (call: CallResource) =>
      resolveWorkspaceCallMediaEncryption({
        call,
        communities,
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
  const handleRealtimeCallEvent = useWorkspaceRealtimeCallEvents({
    activeCallRef,
    receiveSignal,
    reconcileCallResource,
    sessionRef,
  });

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
  const loadCallIceConfig = useCallback(async () => {
    try {
      return await applicationContainer.calls.getIceServers(sessionRef.current);
    } catch (caught) {
      logCallError('workspace:call:ice-config-unavailable', caught);

      throw new Error(copy.calls.iceServersUnavailable);
    }
  }, [sessionRef]);
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
  });

  useEffect(() => {
    if (!communityVoiceTopologyKey) return undefined;

    let cancelled = false;

    void listCalls()
      .then((calls) => {
        if (!cancelled) {
          onCommunitiesChange((current) =>
            communitiesWithCallVoicePresence(current, calls),
          );
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [communityVoiceTopologyKey, listCalls, onCommunitiesChange]);

  useEffect(() => {
    let cancelled = false;
    const identityId = session.identity.id;

    if (startupSyncIdentityRef.current === identityId) return undefined;

    startupSyncIdentityRef.current = identityId;

    void listCalls()
      .then(async (calls) => {
        if (cancelled) return;

        const staleJoinedCalls = calls.filter(
          (call) =>
            call.status === 'active' &&
            call.scope.type === 'community_channel' &&
            call.participants.some(
              (participant) =>
                participant.identityId === identityId && participant.connected,
            ),
        );

        if (
          staleJoinedCalls.length > 0 &&
          !activeCallRef.current &&
          !isCallActionInProgress()
        ) {
          await Promise.all(
            staleJoinedCalls.map((call) =>
              applicationContainer.calls
                .leave(sessionRef.current, call.id)
                .catch(() => undefined),
            ),
          );
          removeCurrentIdentityFromVoicePresence();
          await onCommunitiesReload().catch(() => undefined);

          return;
        }

        calls.forEach((call) => reconcileCallResourceRef.current(call));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    isCallActionInProgress,
    listCalls,
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
