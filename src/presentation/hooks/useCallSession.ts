import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  CallParticipant,
  CallResource,
  CallSignalType,
  CallSession,
} from '../../domain/calls/CallSession';

import { CallPeerConnectionManager } from '../../infrastructure/media/CallPeerConnectionManager';
import { LocalMediaManager } from '../../infrastructure/media/LocalMediaManager';

type SignalSender = (
  recipientIdentityId: string,
  signalType: CallSignalType,
  payload: Record<string, unknown>,
) => Promise<void>;

type StartCallInput = {
  call?: CallResource;
  currentIdentityId: string;
  id: string;
  communityId?: string;
  channelId?: string;
  conversationId?: string;
  kind: CallSession['kind'];
  onSignal: SignalSender;
  participants: CallParticipant[];
  title: string;
};

export function useCallSession(): {
  activeCall: CallSession | null;
  endCall: () => void;
  receiveSignal: (input: {
    callId: string;
    payload: Record<string, unknown>;
    senderIdentityId: string;
    signalType: CallSignalType;
  }) => Promise<void>;
  reconcileCall: (
    call: CallResource,
    input: Omit<StartCallInput, 'call' | 'currentIdentityId' | 'id' | 'onSignal'>,
  ) => void;
  startCall: (input: StartCallInput) => Promise<void>;
  toggleDeafen: () => void;
  toggleMute: () => void;
} {
  const mediaManager = useMemo(() => new LocalMediaManager(), []);
  const peerManager = useMemo(() => new CallPeerConnectionManager(), []);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const activeCallRef = useRef<CallSession | null>(null);
  const currentIdentityIdRef = useRef<string | null>(null);
  const sendSignalRef = useRef<SignalSender | null>(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(
    () => () => {
      mediaManager.stop();
      peerManager.reset();
    },
    [mediaManager, peerManager],
  );

  const startCall = async (input: StartCallInput) => {
    currentIdentityIdRef.current = input.currentIdentityId;
    sendSignalRef.current = input.onSignal;
    const nextCall: CallSession = {
      call: input.call,
      channelId: input.channelId,
      communityId: input.communityId,
      conversationId: input.conversationId,
      id: input.id,
      kind: input.kind,
      participants: input.participants,
      title: input.title,
      deafened: false,
      muted: false,
      startedAt: Date.now(),
      status: 'connecting',
    };

    setActiveCall(nextCall);

    try {
      const stream = await mediaManager.startAudio();

      peerManager.setLocalStream(stream);
      await connectJoinedPeers(nextCall, input.currentIdentityId, input.onSignal);
      setActiveCall((current) =>
        current?.id === nextCall.id ? { ...current, status: 'live' } : current,
      );
    } catch {
      setActiveCall((current) =>
        current?.id === nextCall.id
          ? { ...current, status: 'permission-denied', muted: true }
          : current,
      );
    }
  };

  const endCall = () => {
    mediaManager.stop();
    peerManager.reset();
    currentIdentityIdRef.current = null;
    sendSignalRef.current = null;
    setActiveCall(null);
  };

  const reconcileCall = (
    call: CallResource,
    input: Omit<StartCallInput, 'call' | 'currentIdentityId' | 'id' | 'onSignal'>,
  ) => {
    setActiveCall((current) => {
      if (!current || current.id !== call.id) return current;

      return {
        ...current,
        ...input,
        call,
        participants: mergeParticipantStatuses(input.participants, call),
        status:
          call.status === 'active'
            ? current.status
            : call.status === 'missed'
              ? 'missed'
              : 'ended',
      };
    });

    const currentIdentityId = currentIdentityIdRef.current;
    const sendSignal = sendSignalRef.current;

    if (!currentIdentityId || !sendSignal || call.status !== 'active') return;

    void connectJoinedPeers(
      {
        ...input,
        call,
        deafened: activeCallRef.current?.deafened ?? false,
        id: call.id,
        muted: activeCallRef.current?.muted ?? false,
        participants: mergeParticipantStatuses(input.participants, call),
        startedAt: activeCallRef.current?.startedAt ?? Date.now(),
        status: activeCallRef.current?.status ?? 'live',
      },
      currentIdentityId,
      sendSignal,
    );
  };

  const receiveSignal = async (input: {
    callId: string;
    payload: Record<string, unknown>;
    senderIdentityId: string;
    signalType: CallSignalType;
  }) => {
    const sendSignal = sendSignalRef.current;

    if (!sendSignal || activeCallRef.current?.id !== input.callId) return;

    await peerManager.handleSignal(
      input.senderIdentityId,
      input.signalType,
      input.payload,
      sendSignal,
    );
  };

  const toggleMute = () => {
    setActiveCall((current) => {
      if (!current) return current;

      const muted = !current.muted;

      mediaManager.setMicrophoneMuted(muted);

      return {
        ...current,
        muted,
        participants: current.participants.map((participant, index) =>
          index === 0 ? { ...participant, muted } : participant,
        ),
      };
    });
  };

  const toggleDeafen = () => {
    setActiveCall((current) =>
      current ? { ...current, deafened: !current.deafened } : current,
    );
  };

  return {
    activeCall,
    endCall,
    receiveSignal,
    reconcileCall,
    startCall,
    toggleDeafen,
    toggleMute,
  };

  async function connectJoinedPeers(
    call: CallSession,
    currentIdentityId: string,
    sendSignal: SignalSender,
  ): Promise<void> {
    const joinedParticipants = new Set(
      call.call?.participants
        .filter((participant) => participant.status === 'joined')
        .map((participant) => participant.identityId) ?? [],
    );

    await Promise.all(
      call.participants
        .filter((participant) => participant.identityId !== currentIdentityId)
        .filter((participant) =>
          joinedParticipants.has(participant.identityId),
        )
        .map((participant) =>
          peerManager.ensurePeer(
            participant.identityId,
            currentIdentityId < participant.identityId,
            sendSignal,
          ),
        ),
    );
  }
}

function mergeParticipantStatuses(
  participants: CallParticipant[],
  call: CallResource,
): CallParticipant[] {
  const byIdentityId = new Map(
    call.participants.map((participant) => [
      participant.identityId,
      participant.status,
    ]),
  );

  return participants.map((participant) => ({
    ...participant,
    status: byIdentityId.get(participant.identityId) ?? participant.status,
  }));
}
