import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { CallResource } from '../../../../contexts/calls/domain/callSession.types';
import type { useCallSession } from '../../../../contexts/calls/presentation/hooks/useCallSession';
import type {
  Community,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../composition/applicationContainer';
import { playEndedCallSound } from '../../../../shared/presentation/sounds';
import type { WorkspaceCallDetails } from './resolveWorkspaceCallDetails';

type CallSessionController = ReturnType<typeof useCallSession>;

type CallDepartureInput = {
  activeCall: CallSessionController['activeCall'];
  callDetailsForResource: (call: CallResource) => WorkspaceCallDetails;
  endCall: CallSessionController['endCall'];
  listCalls: () => Promise<CallResource[]>;
  onCommunitiesReload: () => Promise<void>;
  reconcileCallResource: (call: CallResource) => void;
  session: Session;
  setCommunities: Dispatch<SetStateAction<Community[]>>;
};

export function useCallDeparture({
  activeCall,
  callDetailsForResource,
  endCall,
  listCalls,
  onCommunitiesReload,
  reconcileCallResource,
  session,
  setCommunities,
}: CallDepartureInput): {
  cleanupJoinedCalls: (exceptCallId?: string) => Promise<void>;
  leaveActiveCall: () => void;
  leaveCurrentCallForSwitch: () => Promise<void>;
  removeCurrentIdentityFromVoicePresence: () => void;
} {
  const removeCurrentIdentityFromVoicePresence = useCallback(() => {
    setCommunities((current) =>
      current.map((community) => ({
        ...community,
        voiceChannels: (community.voiceChannels ?? []).map((channel) => ({
          ...channel,
          connectedIdentityIds: (channel.connectedIdentityIds ?? []).filter(
            (identityId) => identityId !== session.identity.id,
          ),
        })),
      })),
    );
  }, [session.identity.id, setCommunities]);

  const leaveCallResource = useCallback(
    async (call: CallResource): Promise<void> => {
      if (callDetailsForResource(call).kind === 'one-to-one') {
        await applicationContainer.endCall(session, call.id);

        return;
      }

      await applicationContainer.leaveCall(session, call.id);
    },
    [callDetailsForResource, session],
  );

  const cleanupJoinedCalls = useCallback(
    async (exceptCallId?: string): Promise<void> => {
      const calls = await listCalls();
      const joinedCalls = calls.filter(
        (call) =>
          call.status === 'active' &&
          call.id !== exceptCallId &&
          call.participants.some(
            (participant) =>
              participant.identityId === session.identity.id &&
              participant.connected,
          ),
      );

      if (joinedCalls.length === 0) return;

      await Promise.all(
        joinedCalls.map((call) =>
          leaveCallResource(call).catch(() => undefined),
        ),
      );
      removeCurrentIdentityFromVoicePresence();
    },
    [
      leaveCallResource,
      listCalls,
      removeCurrentIdentityFromVoicePresence,
      session.identity.id,
    ],
  );

  const leaveCurrentCallForSwitch = useCallback(async (): Promise<void> => {
    if (!activeCall) return;

    endCall();
    removeCurrentIdentityFromVoicePresence();

    if (activeCall.call) {
      await leaveCallResource(activeCall.call).catch(() => undefined);
    }
  }, [activeCall, endCall, leaveCallResource, removeCurrentIdentityFromVoicePresence]);

  const leaveActiveCall = useCallback(() => {
    const callId = activeCall?.id;
    const isCommunityVoiceCall = activeCall?.kind === 'community-voice';
    const shouldEndForEveryone = activeCall?.kind === 'one-to-one';

    endCall();
    removeCurrentIdentityFromVoicePresence();
    playEndedCallSound();

    if (!callId) return;

    const request = shouldEndForEveryone
      ? applicationContainer.endCall(session, callId)
      : applicationContainer.leaveCall(session, callId);

    void request
      .then(async () => {
        if (!isCommunityVoiceCall) return;

        await applicationContainer
          .getCall(session, callId)
          .then(reconcileCallResource)
          .catch(() => onCommunitiesReload());
      })
      .catch(() => undefined);
  }, [
    activeCall?.id,
    activeCall?.kind,
    endCall,
    onCommunitiesReload,
    reconcileCallResource,
    removeCurrentIdentityFromVoicePresence,
    session,
  ]);

  return {
    cleanupJoinedCalls,
    leaveActiveCall,
    leaveCurrentCallForSwitch,
    removeCurrentIdentityFromVoicePresence,
  };
}
