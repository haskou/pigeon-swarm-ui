import { useCallback, useEffect, useRef } from 'react';

import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallMicrophoneRequest } from '../../../../contexts/calls/presentation/hooks/CallMicrophoneRequest';
import type { CallParticipant } from '../../../../contexts/calls/presentation/view-models/CallParticipant';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { CallStartActions } from './CallStartActions';
import type { CallStartActionsInput } from './CallStartActionsInput';

import {
  logCallDebug,
  logCallError,
  logCallWarning,
} from '../../../../contexts/calls/infrastructure/media/callDebugLogger';
import { CallPeerConnections } from '../../../../contexts/calls/infrastructure/media/CallPeerConnections';
import { CallMediaEncryptionUnavailableError } from '../../../../contexts/calls/presentation/errors/CallMediaEncryptionUnavailableError';
import { participantJoinWasAccepted } from '../../../../contexts/calls/presentation/hooks/callPeerConnectionPlan';
import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  playAnsweredCallSound,
  stopIncomingCallSound,
} from '../../../../shared/presentation/sounds';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';

function participantStatusLog(
  participant: CallResource['participants'][number],
) {
  return {
    connected: participant.connected,
    identityId: participant.identityId,
    status: participant.status,
  };
}

function findParticipantByIdentity(
  call: CallResource,
  identityId: string,
): CallResource['participants'][number] | undefined {
  return call.participants.find(
    (participant) => participant.identityId === identityId,
  );
}

function fetchLatestCall(
  session: Session,
  pendingCall: CallResource,
): Promise<CallResource> {
  return applicationContainer.calls
    .get(session, pendingCall.id)
    .catch(() => pendingCall);
}

/**
 * A call this browser cannot make is refused before the microphone or the
 * node is asked, with the reason: no WebRTC at all, or, for a private call,
 * no way to encrypt its media. A private call never falls back to plaintext.
 */
function refusedOnThisBrowser(
  setSendError: CallStartActionsInput['setSendError'],
  privateCall: boolean,
): boolean {
  if (!CallPeerConnections.supported()) {
    logCallWarning('workspace:call:refused-without-webrtc', {});
    setSendError(copy.calls.callsUnsupported);

    return true;
  }

  if (!privateCall || CallPeerConnections.mediaEncryptionSupported())
    return false;

  logCallWarning('workspace:call:refused-without-media-encryption', {
    reason: 'unsupported',
  });
  setSendError(new CallMediaEncryptionUnavailableError('unsupported').message);

  return true;
}

export function useCallStartActions({
  activeCall,
  activeCommunity,
  callDetailsForResource,
  callMediaEncryptionForResource,
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
}: CallStartActionsInput): CallStartActions {
  const callActionInProgressRef = useRef(false);
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const isCallActionInProgress = useCallback(
    () => callActionInProgressRef.current,
    [],
  );
  // A call this device cannot encrypt is left on the node at once; no media
  // is sent. The other side may see it ring until the leave lands.
  const callMediaEncryptionOrLeave = useCallback(
    async (call: CallResource) => {
      try {
        return await callMediaEncryptionForResource(call);
      } catch (caught) {
        await applicationContainer.calls
          .leave(sessionRef.current, call.id)
          .catch(() => undefined);

        throw caught;
      }
    },
    [callMediaEncryptionForResource],
  );

  const startConversationCall = useCallback(
    (input: {
      conversationId: string;
      participants: CallParticipant[];
      title: string;
    }) => {
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
        activeCall?.kind === 'one-to-one' &&
        activeCall.conversationId === input.conversationId
      ) {
        logCallWarning('workspace:conversation-call:ignored-already-active', {
          callId: activeCall.id,
          conversationId: input.conversationId,
        });

        return;
      }

      if (refusedOnThisBrowser(setSendError, true)) return;

      let microphone: CallMicrophoneRequest = { stream: null };

      callActionInProgressRef.current = true;
      const localAudioRequest = requestOptionalLocalAudio(
        'workspace:conversation-call:microphone-unavailable',
        {
          conversationId: input.conversationId,
        },
      );

      void localAudioRequest
        .then(async (request) => {
          microphone = request;
          await leaveCurrentCallForSwitch();
          await cleanupJoinedCalls();

          logCallDebug('workspace:conversation-call:create-request', {
            conversationId: input.conversationId,
          });

          return await applicationContainer.calls.startConversation(
            sessionRef.current,
            input.conversationId,
          );
        })
        .then(async (call) => {
          logCallDebug('workspace:conversation-call:created', {
            callId: call.id,
            conversationId: input.conversationId,
            participantStatuses: call.participants.map(participantStatusLog),
          });
          const details = callDetailsForResource(call);
          const mediaEncryption = await callMediaEncryptionOrLeave(call);

          await startCall({
            ...details,
            call,
            currentIdentityId: sessionRef.current.identity.id,
            id: call.id,
            loadIceConfig: loadCallIceConfig,
            localStream: microphone.stream,
            microphoneError: microphone.microphoneError,
            ...mediaEncryption,
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
          stopLocalAudio(microphone.stream);
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
      callMediaEncryptionOrLeave,
      callSignalSender,
      cleanupJoinedCalls,
      leaveCurrentCallForSwitch,
      loadCallIceConfig,
      requestOptionalLocalAudio,
      setSendError,
      startCall,
    ],
  );
  const startLocalCallSession = useCallback(
    async (call: CallResource, microphone: CallMicrophoneRequest) => {
      const details = callDetailsForResource(call);
      const mediaEncryption = await callMediaEncryptionOrLeave(call);

      logCallDebug('workspace:call:start-local-session', {
        callId: call.id,
        participantCount: details.participants.length,
      });
      await startCall({
        ...details,
        call,
        currentIdentityId: sessionRef.current.identity.id,
        id: call.id,
        loadIceConfig: loadCallIceConfig,
        localStream: microphone.stream,
        microphoneError: microphone.microphoneError,
        ...mediaEncryption,
        noiseCancellationEnabled: callNoiseCancellationEnabled,
        onSignal: callSignalSender(call.id),
      });
    },
    [
      callNoiseCancellationEnabled,
      callDetailsForResource,
      callMediaEncryptionOrLeave,
      callSignalSender,
      loadCallIceConfig,
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

      if (
        refusedOnThisBrowser(
          setSendError,
          activeCommunity.visibility !== 'public',
        )
      )
        return;

      callActionInProgressRef.current = true;
      setSendError(null);
      let microphone: CallMicrophoneRequest = { stream: null };

      void (async () => {
        microphone = await requestOptionalLocalAudio(
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
        const call = await applicationContainer.calls.startCommunityChannel(
          sessionRef.current,
          activeCommunity.id,
          channel.id,
        );
        logCallDebug('workspace:community-voice:backend-joined', {
          callId: call.id,
          participantCount: call.participants.length,
          status: call.status,
        });
        await startLocalCallSession(call, microphone);
        logCallDebug('workspace:community-voice:start-local-session-complete', {
          callId: call.id,
        });
        playAnsweredCallSound();
      })()
        .catch((caught) => {
          stopLocalAudio(microphone.stream);
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
      cleanupJoinedCalls,
      leaveCurrentCallForSwitch,
      setSendError,
      startLocalCallSession,
    ],
  );

  const declineIncomingCall = useCallback(() => {
    if (!incomingCall) return;

    const callId = incomingCall.call.id;

    setIncomingCall(null);
    stopIncomingCallSound();
    void applicationContainer.calls
      .leave(sessionRef.current, callId)
      .catch(() => undefined);
  }, [incomingCall]);

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

    // Only direct calls ring, and every direct call is private.
    if (refusedOnThisBrowser(setSendError, true)) {
      declineIncomingCall();

      return;
    }

    const pendingCall = incomingCall.call;

    let microphone: CallMicrophoneRequest = { stream: null };

    callActionInProgressRef.current = true;

    void (async () => {
      const latestCall = await fetchLatestCall(sessionRef.current, pendingCall);
      const currentParticipant = findParticipantByIdentity(
        latestCall,
        sessionRef.current.identity.id,
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
      microphone = await requestOptionalLocalAudio(
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

      const call = await applicationContainer.calls.join(
        sessionRef.current,
        pendingCall.id,
      );

      if (!participantJoinWasAccepted(call, sessionRef.current.identity.id)) {
        logCallDebug('workspace:incoming-call:join-skipped-not-joined', {
          callId: call.id,
          participantStatus: findParticipantByIdentity(
            call,
            sessionRef.current.identity.id,
          )?.status,
        });
        stopLocalAudio(microphone.stream);

        return;
      }

      logCallDebug('workspace:incoming-call:joined', {
        callId: call.id,
        participantStatuses: call.participants.map(participantStatusLog),
      });
      await startLocalCallSession(call, microphone);
    })()
      .catch((caught) => {
        stopLocalAudio(microphone.stream);
        setSendError(toUserErrorMessage(caught, copy.workspace.sendError));
      })
      .finally(() => {
        callActionInProgressRef.current = false;
      });
  }, [
    cleanupJoinedCalls,
    declineIncomingCall,
    incomingCall,
    leaveCurrentCallForSwitch,
    requestOptionalLocalAudio,
    setSendError,
    startLocalCallSession,
  ]);

  const followSupersededCall = useCallback(
    (superseded: CallResource) => {
      const winnerCallId = superseded.supersededByCallId;
      const { scope } = superseded;

      if (!winnerCallId || scope.type !== 'community_channel') return;

      if (callActionInProgressRef.current) {
        logCallWarning('workspace:superseded-call:ignored-action-in-progress', {
          callId: superseded.id,
          supersededByCallId: winnerCallId,
        });

        return;
      }

      callActionInProgressRef.current = true;
      let microphone: CallMicrophoneRequest = { stream: null };

      void (async () => {
        microphone = await requestOptionalLocalAudio(
          'workspace:superseded-call:microphone-unavailable',
          { callId: winnerCallId },
        );
        await leaveCurrentCallForSwitch();
        await cleanupJoinedCalls(winnerCallId);

        logCallDebug('workspace:superseded-call:rejoin-channel', {
          callId: superseded.id,
          supersededByCallId: winnerCallId,
        });
        // The node answers a channel start with the channel's live call and
        // this client signs its join; members are not listed on that call.
        const call = await applicationContainer.calls.startCommunityChannel(
          sessionRef.current,
          scope.communityId,
          scope.channelId,
        );

        await startLocalCallSession(call, microphone);
      })()
        .catch((caught) => {
          stopLocalAudio(microphone.stream);
          logCallError('workspace:superseded-call:failed', caught, {
            callId: superseded.id,
            supersededByCallId: winnerCallId,
          });
          setSendError(toUserErrorMessage(caught, copy.workspace.sendError));
        })
        .finally(() => {
          callActionInProgressRef.current = false;
        });
    },
    [
      cleanupJoinedCalls,
      leaveCurrentCallForSwitch,
      requestOptionalLocalAudio,
      startLocalCallSession,
    ],
  );

  return {
    acceptIncomingCall,
    declineIncomingCall,
    followSupersededCall,
    isCallActionInProgress,
    startCommunityVoiceCall,
    startConversationCall,
  };
}
