import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import type {
  CallParticipant,
  CallParticipantStatus,
  CallResource,
} from '../../../../contexts/calls/domain/callSession.types';
import type { Community } from '../../../../shared/domain/pigeonResources.types';
import type { WorkspaceCallDetails } from './resolveWorkspaceCallDetails';
import type { useCallSession } from '../../../../contexts/calls/presentation/hooks/useCallSession';

import {
  logCallDebug,
  logCallWarning,
} from '../../../../contexts/calls/infrastructure/media/callDebugLogger';
import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  playEndedCallSound,
  playIncomingCallSound,
  stopIncomingCallSound,
} from '../../../../shared/presentation/sounds';
import { showPwaNotification } from '../../../../contexts/notifications/infrastructure/browser/pwaNotifications';

type CallSessionController = ReturnType<typeof useCallSession>;

export type IncomingWorkspaceCall = {
  call: CallResource;
  caller?: CallParticipant;
  participants: CallParticipant[];
  title: string;
};

type CallResourceReconciliationInput = {
  activeCall: CallSessionController['activeCall'];
  callDetailsForResource: (call: CallResource) => WorkspaceCallDetails;
  currentIdentityId: string;
  endCall: CallSessionController['endCall'];
  reconcileCall: CallSessionController['reconcileCall'];
  setCommunities: Dispatch<SetStateAction<Community[]>>;
};

export function useCallResourceReconciliation({
  activeCall,
  callDetailsForResource,
  currentIdentityId,
  endCall,
  reconcileCall,
  setCommunities,
}: CallResourceReconciliationInput): {
  incomingCall: IncomingWorkspaceCall | null;
  reconcileCallResource: (call: CallResource) => void;
  setIncomingCall: Dispatch<SetStateAction<IncomingWorkspaceCall | null>>;
} {
  const [incomingCall, setIncomingCall] =
    useState<IncomingWorkspaceCall | null>(null);
  const activeCallRef = useRef(activeCall);
  const participantStatusesRef = useRef<
    Record<string, Record<string, CallParticipantStatus>>
  >({});
  const notifiedIncomingCallIdsRef = useRef(new Set<string>());

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    if (!incomingCall) return undefined;

    playIncomingCallSound();

    return stopIncomingCallSound;
  }, [incomingCall?.call.id]);

  const reconcileCallResource = useCallback(
    (call: CallResource) => {
      const currentActiveCall = activeCallRef.current;
      const details = callDetailsForResource(call);
      const currentParticipant = call.participants.find(
        (participant) => participant.identityId === currentIdentityId,
      );
      const previousStatuses = participantStatusesRef.current[call.id] ?? {};
      const nextStatuses = Object.fromEntries(
        call.participants.map((participant) => [
          participant.identityId,
          participant.status,
        ]),
      ) as Record<string, CallParticipantStatus>;
      const remoteParticipantLeftActiveCommunityVoice =
        call.scope.type === 'community_channel' &&
        currentActiveCall?.id === call.id &&
        call.status === 'active' &&
        call.participants.some(
          (participant) =>
            participant.identityId !== currentIdentityId &&
            previousStatuses[participant.identityId] === 'joined' &&
            participant.status === 'left',
        );

      participantStatusesRef.current = {
        ...participantStatusesRef.current,
        [call.id]: nextStatuses,
      };

      if (remoteParticipantLeftActiveCommunityVoice) playEndedCallSound();

      if (
        details.kind === 'one-to-one' &&
        incomingCall?.call.id === call.id &&
        currentParticipant?.status !== 'ringing'
      ) {
        setIncomingCall(null);
        stopIncomingCallSound();
      }

      if (call.scope.type === 'community_channel') {
        projectCommunityVoicePresence(call, setCommunities);
      }

      if (call.status !== 'active') {
        if (incomingCall?.call.id === call.id) setIncomingCall(null);

        if (currentActiveCall?.id === call.id) {
          logCallWarning('workspace:call:ended-by-resource-status', {
            callId: call.id,
            status: call.status,
          });
          playEndedCallSound();
          endCall();
        }

        return;
      }

      if (details.kind === 'group') {
        if (incomingCall?.call.id === call.id) setIncomingCall(null);

        if (currentActiveCall?.id === call.id) {
          logCallWarning('workspace:call:ended-unsupported-group-call', {
            callId: call.id,
          });
          playEndedCallSound();
          endCall();
        }

        return;
      }

      if (
        details.kind === 'one-to-one' &&
        currentActiveCall?.id === call.id &&
        call.participants.some(
          (participant) =>
            participant.identityId !== currentIdentityId &&
            ['declined', 'left', 'missed'].includes(participant.status),
        )
      ) {
        const remoteParticipant = call.participants.find(
          (participant) => participant.identityId !== currentIdentityId,
        );

        logCallWarning('workspace:call:ended-by-remote-participant-status', {
          callId: call.id,
          remoteIdentityId: remoteParticipant?.identityId,
          remoteStatus: remoteParticipant?.status,
        });
        playEndedCallSound();
        endCall();

        return;
      }

      if (currentParticipant?.status === 'ringing') {
        if (details.kind === 'community-voice') return;

        const caller = details.participants.find(
          (participant) => participant.identityId === call.creatorIdentityId,
        );

        notifyIncomingCallOnce({
          call,
          details,
          notifiedCallIds: notifiedIncomingCallIdsRef.current,
        });
        setIncomingCall({
          call,
          caller,
          participants: details.participants,
          title: details.title,
        });

        return;
      }

      if (
        details.kind === 'one-to-one' &&
        currentParticipant?.connected &&
        currentActiveCall?.id !== call.id
      ) {
        logCallDebug('workspace:call:joined-on-another-device', {
          callId: call.id,
          identityId: currentIdentityId,
        });

        return;
      }

      if (currentActiveCall?.id === call.id) reconcileCall(call, details);
    },
    [
      callDetailsForResource,
      currentIdentityId,
      endCall,
      incomingCall?.call.id,
      reconcileCall,
      setCommunities,
    ],
  );

  useEffect(() => {
    if (!activeCall?.call) return;

    reconcileCall(activeCall.call, callDetailsForResource(activeCall.call));
  }, [activeCall?.call, callDetailsForResource, reconcileCall]);

  return { incomingCall, reconcileCallResource, setIncomingCall };
}

function projectCommunityVoicePresence(
  call: CallResource,
  setCommunities: Dispatch<SetStateAction<Community[]>>,
): void {
  if (call.scope.type !== 'community_channel') return;

  const scope = call.scope;
  const connectedIdentityIds =
    call.status === 'active'
      ? [
          ...new Set(
            call.participants
              .filter((participant) => participant.connected)
              .map((participant) => participant.identityId),
          ),
        ]
      : [];

  setCommunities((current) =>
    current.map((community) =>
      community.id !== scope.communityId
        ? community
        : {
            ...community,
            voiceChannels: (community.voiceChannels ?? []).map((channel) =>
              channel.id === scope.channelId
                ? { ...channel, connectedIdentityIds }
                : channel,
            ),
          },
    ),
  );
}

function notifyIncomingCallOnce({
  call,
  details,
  notifiedCallIds,
}: {
  call: CallResource;
  details: WorkspaceCallDetails;
  notifiedCallIds: Set<string>;
}): void {
  if (notifiedCallIds.has(call.id)) return;

  notifiedCallIds.add(call.id);
  void showPwaNotification({
    body: details.subtitle
      ? `${details.title} · ${details.subtitle}`
      : details.title,
    tag: `call-${call.id}`,
    title: copy.calls.incoming,
  });
}
