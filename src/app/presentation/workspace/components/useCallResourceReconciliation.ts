import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import type { CallParticipantStatus } from '../../../../contexts/calls/infrastructure/http/resources/CallParticipantStatus';
import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallParticipant } from '../../../../contexts/calls/presentation/view-models/CallParticipant';
import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { CallResourceReconciliationInput } from './CallResourceReconciliationInput';
import type { WorkspaceCallDetails } from './resolveWorkspaceCallDetails';

import {
  logCallDebug,
  logCallWarning,
} from '../../../../contexts/calls/infrastructure/media/callDebugLogger';
import { showPwaNotification } from '../../../../contexts/notifications/presentation/services/pwaNotifications';
import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  playEndedCallSound,
  playIncomingCallSound,
  stopIncomingCallSound,
} from '../../../../shared/presentation/sounds';

export type IncomingWorkspaceCall = {
  call: CallResource;
  caller?: CallParticipant;
  participants: CallParticipant[];
  title: string;
};

function communityWithVoicePresence(
  community: Community,
  scope: { channelId: string; communityId: string },
  connectedIdentityIds: string[],
): Community {
  if (community.id !== scope.communityId) return community;

  let changed = false;
  const voiceChannels = (community.voiceChannels ?? []).map((channel) => {
    if (channel.id !== scope.channelId) return channel;

    const currentIdentityIds = [...(channel.connectedIdentityIds ?? [])].sort();

    if (
      currentIdentityIds.length === connectedIdentityIds.length &&
      currentIdentityIds.every(
        (identityId, index) => identityId === connectedIdentityIds[index],
      )
    ) {
      return channel;
    }

    changed = true;

    return { ...channel, connectedIdentityIds };
  });

  return changed ? { ...community, voiceChannels } : community;
}

function projectCommunityVoicePresence(
  call: CallResource,
  setCommunities: Dispatch<SetStateAction<Community[]>>,
): void {
  if (call.scope.type !== 'community_channel') return;

  const scope = call.scope;
  const connectedIdentityIds =
    call.status === 'active'
      ? Array.from(
          new Set(
            call.participants
              .filter((participant) => participant.connected)
              .map((participant) => participant.identityId),
          ),
        ).sort()
      : [];

  setCommunities((current) =>
    current.map((community) =>
      communityWithVoicePresence(community, scope, connectedIdentityIds),
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

function ringIncomingCall({
  call,
  details,
  notifiedCallIds,
  setIncomingCall,
}: {
  call: CallResource;
  details: WorkspaceCallDetails;
  notifiedCallIds: Set<string>;
  setIncomingCall: Dispatch<SetStateAction<IncomingWorkspaceCall | null>>;
}): void {
  if (details.kind === 'community-voice') return;

  const caller = details.participants.find(
    (participant) => participant.identityId === call.creatorIdentityId,
  );

  notifyIncomingCallOnce({ call, details, notifiedCallIds });
  setIncomingCall({
    call,
    caller,
    participants: details.participants,
    title: details.title,
  });
}

function leftActiveCommunityVoice({
  call,
  currentActiveCall,
  currentIdentityId,
  nextStatuses,
  previousStatuses,
}: {
  call: CallResource;
  currentActiveCall: CallResourceReconciliationInput['activeCall'];
  currentIdentityId: string;
  nextStatuses: Record<string, CallParticipantStatus>;
  previousStatuses: Record<string, CallParticipantStatus>;
}): boolean {
  return (
    call.scope.type === 'community_channel' &&
    currentActiveCall?.id === call.id &&
    call.status === 'active' &&
    Object.entries(previousStatuses).some(
      ([identityId, status]) =>
        identityId !== currentIdentityId &&
        status === 'joined' &&
        (!nextStatuses[identityId] || nextStatuses[identityId] === 'left'),
    )
  );
}

function endedByRemoteParticipant({
  call,
  currentActiveCall,
  currentIdentityId,
  details,
}: {
  call: CallResource;
  currentActiveCall: CallResourceReconciliationInput['activeCall'];
  currentIdentityId: string;
  details: WorkspaceCallDetails;
}): boolean {
  return (
    details.kind === 'one-to-one' &&
    currentActiveCall?.id === call.id &&
    call.participants.some(
      (participant) =>
        participant.identityId !== currentIdentityId &&
        ['declined', 'left', 'missed'].includes(participant.status),
    )
  );
}

function endCallForRemoteParticipant({
  call,
  currentIdentityId,
  endCall,
}: {
  call: CallResource;
  currentIdentityId: string;
  endCall: CallResourceReconciliationInput['endCall'];
}): void {
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
}

function endCallOnUnavailableResource({
  call,
  context,
  currentActiveCall,
  endCall,
  event,
  incomingCallId,
  setIncomingCall,
}: {
  call: CallResource;
  context: Record<string, unknown>;
  currentActiveCall: CallResourceReconciliationInput['activeCall'];
  endCall: CallResourceReconciliationInput['endCall'];
  event: string;
  incomingCallId: string | undefined;
  setIncomingCall: Dispatch<SetStateAction<IncomingWorkspaceCall | null>>;
}): void {
  if (incomingCallId === call.id) setIncomingCall(null);

  if (currentActiveCall?.id === call.id) {
    logCallWarning(event, context);
    playEndedCallSound();
    endCall();
  }
}

function settleEndedCall({
  call,
  currentActiveCall,
  endCall,
  followSupersededCall,
  incomingCallId,
  setIncomingCall,
}: {
  call: CallResource;
  currentActiveCall: CallResourceReconciliationInput['activeCall'];
  endCall: CallResourceReconciliationInput['endCall'];
  followSupersededCall: CallResourceReconciliationInput['followSupersededCall'];
  incomingCallId: string | undefined;
  setIncomingCall: Dispatch<SetStateAction<IncomingWorkspaceCall | null>>;
}): void {
  if (call.supersededByCallId && currentActiveCall?.id === call.id) {
    logCallWarning('workspace:call:superseded', {
      callId: call.id,
      supersededByCallId: call.supersededByCallId,
    });
    followSupersededCall(call);

    return;
  }

  endCallOnUnavailableResource({
    call,
    context: { callId: call.id, status: call.status },
    currentActiveCall,
    endCall,
    event: 'workspace:call:ended-by-resource-status',
    incomingCallId,
    setIncomingCall,
  });
}

function isJoinedOnAnotherDevice({
  call,
  currentActiveCall,
  currentParticipant,
  details,
}: {
  call: CallResource;
  currentActiveCall: CallResourceReconciliationInput['activeCall'];
  currentParticipant: CallResource['participants'][number] | undefined;
  details: WorkspaceCallDetails;
}): boolean {
  return (
    details.kind === 'one-to-one' &&
    Boolean(currentParticipant?.connected) &&
    currentActiveCall?.id !== call.id
  );
}

/**
 * Signals for a call whose session has not started yet are queued, so its peers
 * connect; its roster must survive too, or the older join response seeding the
 * session later retains only the peers it knew about and closes the others.
 */
function rememberRosterAwaitingSession({
  call,
  currentActiveCall,
  currentParticipant,
  rosters,
}: {
  call: CallResource;
  currentActiveCall: CallResourceReconciliationInput['activeCall'];
  currentParticipant: CallResource['participants'][number] | undefined;
  rosters: Map<string, CallResource>;
}): void {
  if (
    currentActiveCall?.id !== call.id &&
    call.status === 'active' &&
    currentParticipant?.status === 'joined'
  ) {
    rosters.set(call.id, call);

    return;
  }

  rosters.delete(call.id);
}

function reconcileCallLifecycle({
  call,
  currentActiveCall,
  currentIdentityId,
  currentParticipant,
  details,
  endCall,
  followSupersededCall,
  incomingCallId,
  notifiedCallIds,
  reconcileCall,
  setIncomingCall,
}: {
  call: CallResource;
  currentActiveCall: CallResourceReconciliationInput['activeCall'];
  currentIdentityId: string;
  currentParticipant: CallResource['participants'][number] | undefined;
  details: WorkspaceCallDetails;
  endCall: CallResourceReconciliationInput['endCall'];
  followSupersededCall: CallResourceReconciliationInput['followSupersededCall'];
  incomingCallId: string | undefined;
  notifiedCallIds: Set<string>;
  reconcileCall: CallResourceReconciliationInput['reconcileCall'];
  setIncomingCall: Dispatch<SetStateAction<IncomingWorkspaceCall | null>>;
}): void {
  if (call.status !== 'active') {
    settleEndedCall({
      call,
      currentActiveCall,
      endCall,
      followSupersededCall,
      incomingCallId,
      setIncomingCall,
    });

    return;
  }

  if (details.kind === 'group') {
    endCallOnUnavailableResource({
      call,
      context: { callId: call.id },
      currentActiveCall,
      endCall,
      event: 'workspace:call:ended-unsupported-group-call',
      incomingCallId,
      setIncomingCall,
    });

    return;
  }

  if (
    endedByRemoteParticipant({
      call,
      currentActiveCall,
      currentIdentityId,
      details,
    })
  ) {
    endCallForRemoteParticipant({ call, currentIdentityId, endCall });

    return;
  }

  if (currentParticipant?.status === 'ringing') {
    ringIncomingCall({ call, details, notifiedCallIds, setIncomingCall });

    return;
  }

  if (
    isJoinedOnAnotherDevice({
      call,
      currentActiveCall,
      currentParticipant,
      details,
    })
  ) {
    logCallDebug('workspace:call:joined-on-another-device', {
      callId: call.id,
      identityId: currentIdentityId,
    });

    return;
  }

  if (currentActiveCall?.id === call.id) reconcileCall(call, details);
}

function clearIncomingCallWhenNotRinging({
  call,
  currentParticipant,
  details,
  incomingCallId,
  setIncomingCall,
}: {
  call: CallResource;
  currentParticipant: CallResource['participants'][number] | undefined;
  details: WorkspaceCallDetails;
  incomingCallId: string | undefined;
  setIncomingCall: Dispatch<SetStateAction<IncomingWorkspaceCall | null>>;
}): void {
  if (
    details.kind === 'one-to-one' &&
    incomingCallId === call.id &&
    currentParticipant?.status !== 'ringing'
  ) {
    setIncomingCall(null);
    stopIncomingCallSound();
  }
}

export function useCallResourceReconciliation({
  activeCall,
  callDetailsForResource,
  currentIdentityId,
  endCall,
  followSupersededCall,
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
  const rostersAwaitingSessionRef = useRef(new Map<string, CallResource>());

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
      const nextStatuses = Object.fromEntries(
        call.participants.map((participant) => [
          participant.identityId,
          participant.status,
        ]),
      ) as Record<string, CallParticipantStatus>;
      const remoteParticipantLeftActiveCommunityVoice =
        leftActiveCommunityVoice({
          call,
          currentActiveCall,
          currentIdentityId,
          nextStatuses,
          previousStatuses: participantStatusesRef.current[call.id] ?? {},
        });

      participantStatusesRef.current = {
        ...participantStatusesRef.current,
        [call.id]: nextStatuses,
      };

      if (remoteParticipantLeftActiveCommunityVoice) playEndedCallSound();

      clearIncomingCallWhenNotRinging({
        call,
        currentParticipant,
        details,
        incomingCallId: incomingCall?.call.id,
        setIncomingCall,
      });

      if (call.scope.type === 'community_channel') {
        projectCommunityVoicePresence(call, setCommunities);
      }

      rememberRosterAwaitingSession({
        call,
        currentActiveCall,
        currentParticipant,
        rosters: rostersAwaitingSessionRef.current,
      });
      reconcileCallLifecycle({
        call,
        currentActiveCall,
        currentIdentityId,
        currentParticipant,
        details,
        endCall,
        followSupersededCall,
        incomingCallId: incomingCall?.call.id,
        notifiedCallIds: notifiedIncomingCallIdsRef.current,
        reconcileCall,
        setIncomingCall,
      });
    },
    [
      callDetailsForResource,
      currentIdentityId,
      endCall,
      followSupersededCall,
      incomingCall?.call.id,
      reconcileCall,
      setCommunities,
    ],
  );

  useEffect(() => {
    if (!activeCall?.call) return;

    const call =
      rostersAwaitingSessionRef.current.get(activeCall.call.id) ??
      activeCall.call;

    rostersAwaitingSessionRef.current.delete(call.id);
    reconcileCall(call, callDetailsForResource(call));
  }, [activeCall?.call, callDetailsForResource, reconcileCall]);

  return { incomingCall, reconcileCallResource, setIncomingCall };
}
