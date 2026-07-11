import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';

import type {
  CallIceServerConfig,
  CallParticipant,
  CallSignalType,
} from '../../../../contexts/calls/domain/callSession.types';
import type { useCallSession } from '../../../../contexts/calls/presentation/hooks/useCallSession';
import type { Community, Session } from '../../../../shared/domain/pigeonResources.types';
import type { IncomingWorkspaceCall } from './useCallResourceReconciliation';
import type { WorkspaceCallDetails } from './resolveWorkspaceCallDetails';

import { applicationContainer } from '../../../composition/applicationContainer';
import {
  logCallDebug,
  logCallError,
  logCallWarning,
} from '../../../../contexts/calls/infrastructure/media/callDebugLogger';
import { participantJoinWasAccepted } from '../../../../contexts/calls/presentation/hooks/callPeerConnectionPlan';
import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  playAnsweredCallSound,
  stopIncomingCallSound,
} from '../../../../shared/presentation/sounds';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';

type CallController = ReturnType<typeof useCallSession>;
type SignalSender = (
  recipientIdentityId: string,
  signalType: CallSignalType,
  payload: Record<string, unknown>,
) => Promise<void>;

type CallStartActionsInput = {
  activeCall: CallController['activeCall'];
  activeCommunity: Community | null;
  callDetailsForResource: (call: Parameters<CallController['reconcileCall']>[0]) => WorkspaceCallDetails;
  callNoiseCancellationEnabled: boolean;
  callSignalSender: (callId: string) => SignalSender;
  cleanupJoinedCalls: (exceptCallId?: string) => Promise<void>;
  incomingCall: IncomingWorkspaceCall | null;
  leaveCurrentCallForSwitch: () => Promise<void>;
  loadCallIceConfig: () => Promise<CallIceServerConfig>;
  requestOptionalLocalAudio: (event: string, context: Record<string, unknown>) => Promise<MediaStream | null>;
  session: Session;
  setIncomingCall: Dispatch<SetStateAction<IncomingWorkspaceCall | null>>;
  setSendError: Dispatch<SetStateAction<string | null>>;
  startCall: CallController['startCall'];
  stopLocalAudio: (stream: MediaStream | null) => void;
};

export function useCallStartActions({
  activeCall,
  activeCommunity,
  callDetailsForResource,
  callNoiseCancellationEnabled,
  callSignalSender,
  cleanupJoinedCalls,
  incomingCall,
  leaveCurrentCallForSwitch,
  loadCallIceConfig,
  requestOptionalLocalAudio,
  session,
  setIncomingCall,
  setSendError,
  startCall,
  stopLocalAudio,
}: CallStartActionsInput) {
  const callActionInProgressRef = useRef(false);
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const isCallActionInProgress = useCallback(
    () => callActionInProgressRef.current,
    [],
  );

  const startConversationCall = useCallback(
    (input: {
      conversationId: string;
      kind: 'group' | 'one-to-one';
      participants: CallParticipant[];
      title: string;
    }) => {
      if (input.kind === 'group') return;

      if (callActionInProgressRef.current) {
        logCallWarning(
          'workspace:conversation-call:ignored-action-in-progress',
          {
            conversationId: input.conversationId,
          },
        );

        return;
      }

      if (
        activeCall?.kind === input.kind &&
        activeCall.conversationId === input.conversationId
      ) {
        logCallWarning('workspace:conversation-call:ignored-already-active', {
          callId: activeCall.id,
          conversationId: input.conversationId,
        });

        return;
      }

      let localStream: MediaStream | null = null;

      callActionInProgressRef.current = true;
      const localAudioRequest = requestOptionalLocalAudio(
        'workspace:conversation-call:microphone-unavailable',
        {
          conversationId: input.conversationId,
        },
      );

      void localAudioRequest
        .then(async (stream) => {
          localStream = stream;
          await leaveCurrentCallForSwitch();
          await cleanupJoinedCalls();

          logCallDebug('workspace:conversation-call:create-request', {
            conversationId: input.conversationId,
          });

          return await applicationContainer.startConversationCall(
            sessionRef.current,
            input.conversationId,
          );
        })
        .then(async (call) => {
          logCallDebug('workspace:conversation-call:created', {
            callId: call.id,
            conversationId: input.conversationId,
            participantStatuses: call.participants.map((participant) => ({
              connected: participant.connected,
              identityId: participant.identityId,
              status: participant.status,
            })),
          });
          const details = callDetailsForResource(call);

          await startCall({
            ...details,
            call,
            currentIdentityId: sessionRef.current.identity.id,
            id: call.id,
            loadIceConfig: loadCallIceConfig,
            localStream,
            noiseCancellationEnabled: callNoiseCancellationEnabled,
            onSignal: callSignalSender(call.id),
            participants:
              details.participants.length > 0
                ? details.participants
                : input.participants,
            title: details.title || input.title,
          });
        })
        .catch((caught) => {
          stopLocalAudio(localStream);
          setSendError(toUserErrorMessage(caught, copy.workspace.sendError));
        })
        .finally(() => {
          callActionInProgressRef.current = false;
        });
    },
    [
      activeCall?.conversationId,
      activeCall?.id,
      activeCall?.kind,
      callNoiseCancellationEnabled,
      callDetailsForResource,
      callSignalSender,
      cleanupJoinedCalls,
      leaveCurrentCallForSwitch,
      loadCallIceConfig,
      requestOptionalLocalAudio,
      startCall,
    ],
  );
  const startCommunityVoiceCall = useCallback(
    (channel: {
      connectedIdentityIds?: string[];
      id: string;
      name: string;
    }) => {
      logCallDebug('workspace:community-voice-clicked', {
        activeCallId: activeCall?.id,
        activeCallKind: activeCall?.kind,
        channelId: channel.id,
        channelName: channel.name,
        communityId: activeCommunity?.id,
        connectedIdentityCount: channel.connectedIdentityIds?.length ?? 0,
      });

      if (!activeCommunity) {
        logCallWarning(
          'workspace:community-voice:ignored-no-active-community',
          {
            channelId: channel.id,
          },
        );

        return;
      }

      if (
        activeCall?.kind === 'community-voice' &&
        activeCall.communityId === activeCommunity.id &&
        activeCall.channelId === channel.id
      ) {
        logCallWarning('workspace:community-voice:ignored-already-active', {
          callId: activeCall.id,
          channelId: channel.id,
          communityId: activeCommunity.id,
        });

        return;
      }

      callActionInProgressRef.current = true;
      setSendError(null);
      let localStream: MediaStream | null = null;

      void (async () => {
        localStream = await requestOptionalLocalAudio(
          'workspace:community-voice:microphone-unavailable',
          {
            channelId: channel.id,
            communityId: activeCommunity.id,
          },
        );

        logCallDebug('workspace:community-voice:leaving-current-call', {
          channelId: channel.id,
          communityId: activeCommunity.id,
        });
        await leaveCurrentCallForSwitch();
        await cleanupJoinedCalls();

        logCallDebug('workspace:community-voice:request-backend-join', {
          channelId: channel.id,
          communityId: activeCommunity.id,
        });
        const call = await applicationContainer.startCommunityChannelCall(
          sessionRef.current,
          activeCommunity.id,
          channel.id,
        );
        logCallDebug('workspace:community-voice:backend-joined', {
          callId: call.id,
          participantCount: call.participants.length,
          status: call.status,
        });
        const currentIdentityId = sessionRef.current.identity.id;
        const details = callDetailsForResource(call);

        logCallDebug('workspace:community-voice:start-local-session', {
          callId: call.id,
          participantCount: details.participants.length,
        });
        await startCall({
          ...details,
          call,
          currentIdentityId,
          id: call.id,
          loadIceConfig: loadCallIceConfig,
          localStream,
          noiseCancellationEnabled: callNoiseCancellationEnabled,
          onSignal: callSignalSender(call.id),
        });
        logCallDebug('workspace:community-voice:start-local-session-complete', {
          callId: call.id,
        });
        playAnsweredCallSound();
      })()
        .catch((caught) => {
          stopLocalAudio(localStream);
          logCallError('workspace:community-voice:failed', caught, {
            channelId: channel.id,
            communityId: activeCommunity.id,
          });
          setSendError(toUserErrorMessage(caught, copy.workspace.sendError));
        })
        .finally(() => {
          callActionInProgressRef.current = false;
        });
    },
    [
      activeCommunity,
      activeCall?.channelId,
      activeCall?.communityId,
      activeCall?.kind,
      callNoiseCancellationEnabled,
      callDetailsForResource,
      callSignalSender,
      cleanupJoinedCalls,
      leaveCurrentCallForSwitch,
      loadCallIceConfig,
      startCall,
    ],
  );

  const acceptIncomingCall = useCallback(() => {
    if (!incomingCall) return;

    if (callActionInProgressRef.current) {
      logCallWarning(
        'workspace:incoming-call:accept-ignored-action-in-progress',
        {
          callId: incomingCall.call.id,
        },
      );

      return;
    }

    const pendingCall = incomingCall.call;

    let localStream: MediaStream | null = null;

    callActionInProgressRef.current = true;

    void (async () => {
      const latestCall = await applicationContainer
        .getCall(sessionRef.current, pendingCall.id)
        .catch(() => pendingCall);
      const currentParticipant = latestCall.participants.find(
        (participant) =>
          participant.identityId === sessionRef.current.identity.id,
      );

      if (currentParticipant?.status !== 'ringing') {
        logCallDebug('workspace:incoming-call:accept-ignored-not-ringing', {
          callId: latestCall.id,
          participantStatus: currentParticipant?.status,
        });
        setIncomingCall(null);
        stopIncomingCallSound();

        return;
      }

      setIncomingCall(null);
      stopIncomingCallSound();
      localStream = await requestOptionalLocalAudio(
        'workspace:incoming-call:microphone-unavailable',
        {
          callId: pendingCall.id,
        },
      );

      await leaveCurrentCallForSwitch();
      await cleanupJoinedCalls(pendingCall.id);

      logCallDebug('workspace:incoming-call:join-request', {
        callId: pendingCall.id,
      });

      const call = await applicationContainer.joinCall(
        sessionRef.current,
        pendingCall.id,
      );
      if (!participantJoinWasAccepted(call, sessionRef.current.identity.id)) {
        logCallDebug('workspace:incoming-call:join-skipped-not-joined', {
          callId: call.id,
          participantStatus: call.participants.find(
            (participant) =>
              participant.identityId === sessionRef.current.identity.id,
          )?.status,
        });
        stopLocalAudio(localStream);

        return;
      }

      logCallDebug('workspace:incoming-call:joined', {
        callId: call.id,
        participantStatuses: call.participants.map((participant) => ({
          connected: participant.connected,
          identityId: participant.identityId,
          status: participant.status,
        })),
      });
      const details = callDetailsForResource(call);

      await startCall({
        ...details,
        call,
        currentIdentityId: sessionRef.current.identity.id,
        id: call.id,
        loadIceConfig: loadCallIceConfig,
        localStream,
        noiseCancellationEnabled: callNoiseCancellationEnabled,
        onSignal: callSignalSender(call.id),
      });
    })()
      .catch((caught) => {
        stopLocalAudio(localStream);
        setSendError(toUserErrorMessage(caught, copy.workspace.sendError));
      })
      .finally(() => {
        callActionInProgressRef.current = false;
      });
  }, [
    callNoiseCancellationEnabled,
    callDetailsForResource,
    callSignalSender,
    cleanupJoinedCalls,
    incomingCall,
    leaveCurrentCallForSwitch,
    loadCallIceConfig,
    requestOptionalLocalAudio,
    startCall,
  ]);

  const declineIncomingCall = useCallback(() => {
    if (!incomingCall) return;

    const callId = incomingCall.call.id;

    setIncomingCall(null);
    stopIncomingCallSound();
    void applicationContainer
      .leaveCall(sessionRef.current, callId)
      .catch(() => undefined);
  }, [incomingCall]);

  return {
    acceptIncomingCall,
    declineIncomingCall,
    isCallActionInProgress,
    startCommunityVoiceCall,
    startConversationCall,
  };
}
