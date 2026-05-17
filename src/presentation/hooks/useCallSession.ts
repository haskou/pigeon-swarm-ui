import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  CallParticipant,
  CallIceServerConfig,
  CallResource,
  CallSignalType,
  CallSession,
} from '../../domain/calls/CallSession';
import type { PeerMediaStats } from '../../infrastructure/media/CallPeerConnectionManager';

import {
  logCallDebug,
  logCallError,
  logCallWarning,
} from '../../infrastructure/media/callDebugLogger';
import { CallPeerConnectionManager } from '../../infrastructure/media/CallPeerConnectionManager';
import { LocalMediaManager } from '../../infrastructure/media/LocalMediaManager';

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

type ReconcileCallInput = Omit<
  StartCallInput,
  'call' | 'currentIdentityId' | 'iceConfig' | 'id' | 'onSignal'
>;

export function useCallSession(): {
  activeCall: CallSession | null;
  endCall: () => void;
  receiveSignal: (input: ReceivedSignal) => Promise<void>;
  reconcileCall: (call: CallResource, input: ReconcileCallInput) => void;
  startCall: (input: StartCallInput) => Promise<void>;
  setParticipantVolume: (identityId: string, volumePercent: number) => void;
  toggleCamera: () => Promise<void>;
  toggleDeafen: () => void;
  toggleMute: () => void;
  toggleScreenShare: () => Promise<void>;
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
      const remoteStreams = peerManager.remoteMediaStreams();
      const localAudioLevel = mediaManager.localAudioLevel();

      if (cancelled) return;

      setActiveCall((current) => {
        if (!current) return current;

        return {
          ...current,
          cameraEnabled: mediaManager.hasCamera(),
          localPreviewStream: mediaManager.previewStream(),
          participants: participantsWithMediaState(
            current,
            stats,
            remoteStreams,
            localAudioLevel,
          ),
          screenSharing: mediaManager.hasScreenShare(),
        };
      });
    };

    void refreshStats();
    const interval = window.setInterval(() => {
      void refreshStats();
    }, 250);

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
      deafened: false,
      hasMicrophone: input.localStream !== null,
      id: input.id,
      cameraEnabled: false,
      kind: input.kind,
      muted: input.localStream === null,
      participants: input.participants,
      participantVolumes: {},
      screenSharing: false,
      startedAt: Date.now(),
      status: 'connecting',
      subtitle: input.subtitle,
      title: input.title,
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

    let stream: MediaStream | null = null;

    try {
      stream =
        input.localStream === null
          ? null
          : input.localStream
            ? mediaManager.useStream(input.localStream)
            : await mediaManager.startAudio().catch((error): null => {
                logCallWarning('session:start-call:microphone-unavailable', {
                  callId: nextCall.id,
                  error,
                });

                return null;
              });

      if (!stream) {
        setActiveCall((current) =>
          current?.id === nextCall.id
            ? { ...current, hasMicrophone: false, muted: true }
            : current,
        );
      }

      logCallDebug('session:start-call:local-media-ready', {
        callId: nextCall.id,
        hasStream: Boolean(stream),
      });
      peerManager.configure(input.iceConfig);
      peerManager.setLocalStream(stream);
      setActiveCall((current) =>
        current?.id === nextCall.id
          ? { ...current, localPreviewStream: stream ?? undefined }
          : current,
      );
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
              muted: true,
              status: 'permission-denied',
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

  const reconcileCall = (call: CallResource, input: ReconcileCallInput) => {
    const participants = mergeParticipantStatuses(input.participants, call);

    setActiveCall((current) => {
      if (!current || current.id !== call.id) return current;

      return {
        ...current,
        ...input,
        call,
        participants,
        participantVolumes: current.participantVolumes,
        status: reconciledCallStatus(call, current),
      };
    });

    const currentIdentityId = currentIdentityIdRef.current;
    const sendSignal = sendSignalRef.current;

    if (!currentIdentityId || !sendSignal || call.status !== 'active') return;

    void connectJoinedPeers(
      callSessionForJoinedPeerConnection(
        call,
        currentIdentityId,
        input,
        participants,
        activeCallRef.current,
      ),
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

  const toggleCamera = async () => {
    const current = activeCallRef.current;

    if (!current) {
      logCallWarning('session:toggle-camera:ignored-no-active-call');

      return;
    }

    try {
      const cameraEnabled = !current.cameraEnabled;
      const stream = cameraEnabled
        ? await mediaManager.enableCamera()
        : mediaManager.disableCamera();

      peerManager.setLocalStream(stream);
      setActiveCall((active) =>
        active?.id === current.id
          ? localMediaSession(active, {
              cameraEnabled,
              localPreviewStream: stream ?? undefined,
              screenSharing: mediaManager.hasScreenShare(),
            })
          : active,
      );
    } catch (error) {
      logCallError('session:toggle-camera:failed', error, {
        callId: current.id,
      });
    }
  };

  const toggleScreenShare = async () => {
    const current = activeCallRef.current;

    if (!current) {
      logCallWarning('session:toggle-screen-share:ignored-no-active-call');

      return;
    }

    try {
      const screenSharing = !current.screenSharing;
      const stream = screenSharing
        ? await mediaManager.enableScreenShare()
        : mediaManager.disableScreenShare();

      peerManager.setLocalStream(stream);
      setActiveCall((active) =>
        active?.id === current.id
          ? localMediaSession(active, {
              cameraEnabled: mediaManager.hasCamera(),
              localPreviewStream: stream ?? undefined,
              screenSharing,
            })
          : active,
      );
    } catch (error) {
      logCallError('session:toggle-screen-share:failed', error, {
        callId: current.id,
      });
    }
  };

  const setParticipantVolume = (identityId: string, volumePercent: number) => {
    peerManager.setPeerVolume(identityId, volumePercent);
    setActiveCall((current) => {
      if (!current) return current;

      return {
        ...current,
        participantVolumes: {
          ...current.participantVolumes,
          [identityId]: volumePercent,
        },
      };
    });
  };

  return {
    activeCall,
    endCall,
    receiveSignal,
    reconcileCall,
    setParticipantVolume,
    startCall,
    toggleCamera,
    toggleDeafen,
    toggleMute,
    toggleScreenShare,
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

function reconciledCallStatus(
  call: CallResource,
  current: CallSession,
): CallSession['status'] {
  if (call.status === 'active') return current.status;

  return call.status === 'missed' ? 'missed' : 'ended';
}

function callSessionForJoinedPeerConnection(
  call: CallResource,
  currentIdentityId: string,
  input: ReconcileCallInput,
  participants: CallParticipant[],
  activeCall: CallSession | null,
): CallSession {
  return {
    ...input,
    call,
    cameraEnabled: activeCall?.cameraEnabled ?? false,
    currentIdentityId,
    deafened: activeCall?.deafened ?? false,
    hasMicrophone: activeCall?.hasMicrophone ?? false,
    id: call.id,
    localPreviewStream: activeCall?.localPreviewStream,
    muted: activeCall?.muted ?? false,
    participants,
    participantVolumes: activeCall?.participantVolumes ?? {},
    screenSharing: activeCall?.screenSharing ?? false,
    startedAt: activeCall?.startedAt ?? Date.now(),
    status: activeCall?.status ?? 'live',
  };
}

function participantsWithMediaState(
  call: CallSession,
  stats: Record<string, PeerMediaStats>,
  remoteStreams: Record<string, MediaStream>,
  localAudioLevel: number,
): CallParticipant[] {
  return call.participants.map((participant) =>
    participant.identityId === call.currentIdentityId
      ? localParticipantWithMediaState(participant, call, localAudioLevel)
      : remoteParticipantWithMediaState(participant, stats, remoteStreams),
  );
}

function localParticipantWithMediaState(
  participant: CallParticipant,
  call: CallSession,
  audioLevel: number,
): CallParticipant {
  return {
    ...participant,
    audioLevel,
    mediaStream: call.localPreviewStream,
    muted: call.muted,
    screenSharing: call.screenSharing,
    speaking: !call.muted && audioLevel > 0.04,
    videoEnabled: hasVideoTrack(call.localPreviewStream),
  };
}

function remoteParticipantWithMediaState(
  participant: CallParticipant,
  stats: Record<string, PeerMediaStats>,
  remoteStreams: Record<string, MediaStream>,
): CallParticipant {
  const stat = stats[participant.identityId];
  const mediaStream = remoteStreams[participant.identityId];

  return {
    ...participant,
    audioLevel: stat?.audioLevel,
    connectionState: stat?.connectionState ?? participant.connectionState,
    latencyMs: stat?.latencyMs,
    mediaStream,
    packetsLost: stat?.packetsLost,
    speaking: stat?.speaking ?? false,
    videoEnabled: hasVideoTrack(mediaStream),
  };
}

function localMediaSession(
  call: CallSession,
  media: Pick<
    CallSession,
    'cameraEnabled' | 'localPreviewStream' | 'screenSharing'
  >,
): CallSession {
  return {
    ...call,
    ...media,
    participants: call.participants.map((participant) =>
      participant.identityId === call.currentIdentityId
        ? {
            ...participant,
            mediaStream: media.localPreviewStream,
            screenSharing: media.screenSharing,
            videoEnabled: hasVideoTrack(media.localPreviewStream),
          }
        : participant,
    ),
  };
}

function hasVideoTrack(stream?: MediaStream): boolean {
  return Boolean(
    stream?.getVideoTracks().some((track) => track.readyState === 'live'),
  );
}
