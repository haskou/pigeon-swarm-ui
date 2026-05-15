import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  CallParticipant,
  CallIceServerConfig,
  CallResource,
  CallSignalType,
  CallSession,
} from '../../domain/calls/CallSession';

import { CallPeerConnectionManager } from '../../infrastructure/media/CallPeerConnectionManager';
import type { PeerMediaStats } from '../../infrastructure/media/CallPeerConnectionManager';
import { LocalMediaManager } from '../../infrastructure/media/LocalMediaManager';
import {
  logCallDebug,
  logCallError,
  logCallWarning,
} from '../../infrastructure/media/callDebugLogger';

type SignalSender = (
  recipientIdentityId: string,
  signalType: CallSignalType,
  payload: Record<string, unknown>,
) => Promise<void>;

type ReceivedSignal = {
  callId: string;
  payload: Record<string, unknown>;
  senderIdentityId: string;
  signalType: CallSignalType;
};

type StartCallInput = {
  call?: CallResource;
  currentIdentityId: string;
  id: string;
  communityId?: string;
  channelId?: string;
  conversationId?: string;
  kind: CallSession['kind'];
  iceConfig: CallIceServerConfig;
  localStream?: MediaStream | null;
  onSignal: SignalSender;
  participants: CallParticipant[];
  subtitle?: string;
  title: string;
};

export function useCallSession(): {
  activeCall: CallSession | null;
  endCall: () => void;
  receiveSignal: (input: ReceivedSignal) => Promise<void>;
  reconcileCall: (
    call: CallResource,
    input: Omit<
      StartCallInput,
      'call' | 'currentIdentityId' | 'iceConfig' | 'id' | 'onSignal'
    >,
  ) => void;
  startCall: (input: StartCallInput) => Promise<void>;
  setParticipantVolume: (identityId: string, volumePercent: number) => void;
  toggleDeafen: () => void;
  toggleMute: () => void;
} {
  const mediaManager = useMemo(() => new LocalMediaManager(), []);
  const peerManager = useMemo(() => new CallPeerConnectionManager(), []);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const activeCallRef = useRef<CallSession | null>(null);
  const currentIdentityIdRef = useRef<string | null>(null);
  const pendingSignalsRef = useRef(new Map<string, ReceivedSignal[]>());
  const sendSignalRef = useRef<SignalSender | null>(null);
  const startingCallIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    if (!activeCall) return undefined;

    let cancelled = false;

    const refreshStats = async () => {
      const stats = await peerManager
        .collectStats()
        .catch((): Record<string, PeerMediaStats> => ({}));

      if (cancelled) return;

      setActiveCall((current) => {
        if (!current) return current;

        return {
          ...current,
          participants: current.participants.map((participant) => {
            const stat = stats[participant.identityId];

            return stat
              ? {
                  ...participant,
                  audioLevel: stat.audioLevel,
                  connectionState: stat.connectionState,
                  latencyMs: stat.latencyMs,
                  packetsLost: stat.packetsLost,
                  speaking: stat.speaking,
                }
              : participant;
          }),
        };
      });
    };

    void refreshStats();
    const interval = window.setInterval(() => {
      void refreshStats();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeCall?.id, peerManager]);

  useEffect(
    () => () => {
      mediaManager.stop();
      peerManager.reset();
    },
    [mediaManager, peerManager],
  );

  const startCall = async (input: StartCallInput) => {
    logCallDebug('session:start-call:requested', {
      callId: input.id,
      channelId: input.channelId,
      communityId: input.communityId,
      conversationId: input.conversationId,
      hasProvidedLocalStream: input.localStream !== undefined,
      kind: input.kind,
      participantCount: input.participants.length,
    });
    currentIdentityIdRef.current = input.currentIdentityId;
    sendSignalRef.current = input.onSignal;
    const nextCall: CallSession = {
      call: input.call,
      channelId: input.channelId,
      communityId: input.communityId,
      conversationId: input.conversationId,
      currentIdentityId: input.currentIdentityId,
      id: input.id,
      kind: input.kind,
      participants: input.participants,
      subtitle: input.subtitle,
      title: input.title,
      deafened: false,
      hasMicrophone: input.localStream !== null,
      muted: input.localStream === null,
      startedAt: Date.now(),
      status: 'connecting',
    };

    setActiveCall(nextCall);
    activeCallRef.current = nextCall;
    startingCallIdRef.current = nextCall.id;
    logCallDebug('session:start-call:active-call-created', {
      callId: nextCall.id,
      hasMicrophone: nextCall.hasMicrophone,
      muted: nextCall.muted,
      status: nextCall.status,
    });

    try {
      const stream =
        input.localStream === null
          ? null
          : input.localStream
            ? mediaManager.useStream(input.localStream)
            : await mediaManager.startAudio();

      logCallDebug('session:start-call:local-media-ready', {
        callId: nextCall.id,
        hasStream: Boolean(stream),
      });
      peerManager.configure(input.iceConfig);
      peerManager.setLocalStream(stream);
      startingCallIdRef.current = null;
      await flushPendingSignals(nextCall.id, input.onSignal);
      await connectJoinedPeers(
        nextCall,
        input.currentIdentityId,
        input.onSignal,
      );
      await flushPendingSignals(nextCall.id, input.onSignal);
      setActiveCall((current) =>
        current?.id === nextCall.id ? { ...current, status: 'live' } : current,
      );
      logCallDebug('session:start-call:live', {
        callId: nextCall.id,
      });
    } catch (error) {
      logCallError('session:start-call:failed', error, {
        callId: nextCall.id,
      });
      mediaManager.stop();
      peerManager.reset();
      pendingSignalsRef.current.delete(nextCall.id);
      if (startingCallIdRef.current === nextCall.id) {
        startingCallIdRef.current = null;
      }
      setActiveCall((current) =>
        current?.id === nextCall.id
          ? {
              ...current,
              hasMicrophone: false,
              status: 'permission-denied',
              muted: true,
            }
          : current,
      );
    }
  };

  const endCall = () => {
    logCallDebug('session:end-call', {
      callId: activeCallRef.current?.id,
      status: activeCallRef.current?.status,
    });
    mediaManager.stop();
    peerManager.reset();
    currentIdentityIdRef.current = null;
    pendingSignalsRef.current.clear();
    sendSignalRef.current = null;
    startingCallIdRef.current = null;
    setActiveCall(null);
  };

  const reconcileCall = (
    call: CallResource,
    input: Omit<
      StartCallInput,
      'call' | 'currentIdentityId' | 'iceConfig' | 'id' | 'onSignal'
    >,
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
        currentIdentityId,
        deafened: activeCallRef.current?.deafened ?? false,
        hasMicrophone: activeCallRef.current?.hasMicrophone ?? false,
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

  const receiveSignal = async (input: ReceivedSignal) => {
    logCallDebug('session:receive-signal', {
      activeCallId: activeCallRef.current?.id,
      callId: input.callId,
      senderIdentityId: input.senderIdentityId,
      signalType: input.signalType,
      startingCallId: startingCallIdRef.current,
    });
    const sendSignal = sendSignalRef.current;
    const activeCallId = activeCallRef.current?.id;

    if (activeCallId && activeCallId !== input.callId) {
      logCallWarning('session:receive-signal:ignored-other-call', {
        activeCallId,
        callId: input.callId,
      });
      return;
    }

    if (!sendSignal || startingCallIdRef.current === input.callId) {
      logCallDebug('session:receive-signal:queued', {
        callId: input.callId,
        hasSignalSender: Boolean(sendSignal),
        signalType: input.signalType,
      });
      queuePendingSignal(input);

      return;
    }

    await peerManager.handleSignal(
      input.senderIdentityId,
      input.signalType,
      input.payload,
      sendSignal,
    );
  };

  const toggleMute = () => {
    setActiveCall((current) => {
      if (!current) {
        logCallWarning('session:toggle-mute:ignored-no-active-call');
        return current;
      }
      if (!current.hasMicrophone) {
        logCallWarning('session:toggle-mute:ignored-no-microphone', {
          callId: current.id,
          status: current.status,
        });
        return current;
      }

      const muted = !current.muted;

      logCallDebug('session:toggle-mute', {
        callId: current.id,
        muted,
      });
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
    setActiveCall((current) => {
      if (!current) {
        logCallWarning('session:toggle-deafen:ignored-no-active-call');
        return current;
      }

      const deafened = !current.deafened;

      logCallDebug('session:toggle-deafen', {
        callId: current.id,
        deafened,
      });
      peerManager.setDeafened(deafened);

      return { ...current, deafened };
    });
  };

  const setParticipantVolume = (
    identityId: string,
    volumePercent: number,
  ) => {
    peerManager.setPeerVolume(identityId, volumePercent);
  };

  return {
    activeCall,
    endCall,
    receiveSignal,
    reconcileCall,
    setParticipantVolume,
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

    logCallDebug('session:connect-joined-peers', {
      callId: call.id,
      currentIdentityId,
      joinedParticipantCount: joinedParticipants.size,
      participantCount: call.participants.length,
    });
    await Promise.all(
      call.participants
        .filter((participant) => participant.identityId !== currentIdentityId)
        .filter((participant) => joinedParticipants.has(participant.identityId))
        .map((participant) =>
          peerManager.ensurePeer(
            participant.identityId,
            currentIdentityId < participant.identityId,
            sendSignal,
          ),
        ),
    );
  }

  async function flushPendingSignals(
    callId: string,
    sendSignal: SignalSender,
  ): Promise<void> {
    const signals = pendingSignalsRef.current.get(callId);

    if (!signals?.length) return;

    pendingSignalsRef.current.delete(callId);
    logCallDebug('session:flush-pending-signals', {
      callId,
      signalCount: signals.length,
    });

    for (const signal of signals) {
      await peerManager.handleSignal(
        signal.senderIdentityId,
        signal.signalType,
        signal.payload,
        sendSignal,
      );
    }
  }

  function queuePendingSignal(signal: ReceivedSignal): void {
    const signals = pendingSignalsRef.current.get(signal.callId) ?? [];

    signals.push(signal);
    pendingSignalsRef.current.set(signal.callId, signals.slice(-100));
    logCallDebug('session:queue-pending-signal', {
      callId: signal.callId,
      queuedCount: signals.length,
      signalType: signal.signalType,
    });
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
