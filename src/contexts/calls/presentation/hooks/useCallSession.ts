import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  CallParticipant,
  CallParticipantMediaConnection,
  CallIceServerConfig,
  CallMicrophoneErrorCode,
  CallResource,
  CallSignalType,
  CallSession,
  ScreenShareQualityPreset,
} from '../../domain/callSession.types';
import type { PeerMediaStats } from '../../infrastructure/media/CallPeerConnectionManager';

import {
  logCallDebug,
  logCallError,
  logCallWarning,
} from '../../infrastructure/media/callDebugLogger';
import { CallPeerConnectionManager } from '../../infrastructure/media/CallPeerConnectionManager';
import { LocalMediaManager } from '../../infrastructure/media/LocalMediaManager';
import {
  retainedRemotePeerIdentityIds,
  signalingRemotePeerIdentityIds,
  shouldCreateInitialOffer,
} from './callPeerConnectionPlan';

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
  loadIceConfig: () => Promise<CallIceServerConfig>;
  localStream?: MediaStream | null;
  noiseCancellationEnabled: boolean;
  onSignal: SignalSender;
  participants: CallParticipant[];
  subtitle?: string;
  title: string;
};

type ReconcileCallInput = Omit<
  StartCallInput,
  | 'call'
  | 'currentIdentityId'
  | 'id'
  | 'loadIceConfig'
  | 'noiseCancellationEnabled'
  | 'onSignal'
>;

export function useCallSession(): {
  activeCall: CallSession | null;
  callMediaConnections: () => CallParticipantMediaConnection[];
  endCall: () => void;
  receiveSignal: (input: ReceivedSignal) => Promise<void>;
  reconcileCall: (call: CallResource, input: ReconcileCallInput) => void;
  startCall: (input: StartCallInput) => Promise<void>;
  setParticipantVolume: (identityId: string, volumePercent: number) => void;
  setParticipantScreenShareVolume: (
    identityId: string,
    volumePercent: number,
  ) => void;
  setScreenShareQuality: (quality: ScreenShareQualityPreset) => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleDeafen: () => void;
  toggleMute: () => void;
  toggleNoiseCancellation: (enabled: boolean) => Promise<void>;
  retryMicrophone: () => Promise<void>;
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
  const callMediaConnections = useCallback(
    () => peerManager.mediaConnections(),
    [peerManager],
  );

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    if (!activeCall) return undefined;

    let cancelled = false;
    let refreshInFlight = false;

    const refreshStats = async () => {
      if (refreshInFlight) return;

      refreshInFlight = true;
      const stats = await peerManager
        .collectStats()
        .catch((): Record<string, PeerMediaStats> => ({}));
      const remoteStreams = peerManager.remoteMediaStreams();
      const remoteScreenStreams = peerManager.remoteScreenMediaStreams();
      const localAudioLevel = mediaManager.localAudioLevel();
      const screenStream = mediaManager.screenPreviewStream();

      refreshInFlight = false;
      if (cancelled) return;

      setActiveCall((current) => {
        if (!current) return current;

        const nextParticipants = participantsWithMediaState(
          current,
          stats,
          remoteStreams,
          remoteScreenStreams,
          localAudioLevel,
          screenStream,
        );
        const nextCameraEnabled = mediaManager.hasCamera();
        const nextLocalPreviewStream = mediaManager.previewStream();
        const nextScreenSharing = mediaManager.hasScreenShare();

        if (
          localMediaFlagsChanged(current, nextCameraEnabled, nextScreenSharing)
        ) {
          peerManager.setLocalStream(nextLocalPreviewStream ?? null);
        }

        if (
          current.cameraEnabled === nextCameraEnabled &&
          current.localPreviewStream === nextLocalPreviewStream &&
          current.screenSharing === nextScreenSharing &&
          callParticipantsMediaStateEqual(
            current.participants,
            nextParticipants,
          )
        ) {
          return current;
        }

        return {
          ...current,
          cameraEnabled: nextCameraEnabled,
          localPreviewStream: nextLocalPreviewStream,
          participants: nextParticipants,
          screenSharing: nextScreenSharing,
        };
      });
    };

    void refreshStats();
    const interval = window.setInterval(() => {
      void refreshStats();
    }, 500);

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
      cameraEnabled: false,
      channelId: input.channelId,
      communityId: input.communityId,
      conversationId: input.conversationId,
      currentIdentityId: input.currentIdentityId,
      deafened: false,
      hasMicrophone: input.localStream !== null,
      id: input.id,
      kind: input.kind,
      muted: input.localStream === null,
      noiseCancellationEnabled: input.noiseCancellationEnabled,
      participants: input.participants,
      participantVolumes: {},
      screenShareAudioEnabled: true,
      screenShareQuality: 'auto',
      screenShareVolumes: {},
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
    let microphoneError: CallMicrophoneErrorCode | undefined;

    try {
      stream =
        input.localStream === null
          ? null
          : input.localStream
            ? mediaManager.useStream(input.localStream, {
                noiseCancellationEnabled: input.noiseCancellationEnabled,
              })
            : await mediaManager
                .startAudio({
                  noiseCancellationEnabled: input.noiseCancellationEnabled,
                })
                .catch((error): null => {
                  logCallWarning('session:start-call:microphone-unavailable', {
                    callId: nextCall.id,
                    error,
                  });
                  microphoneError = classifyMicrophoneError(error);

                  return null;
                });

      if (!stream) {
        setActiveCall((current) =>
          current?.id === nextCall.id
            ? {
                ...current,
                hasMicrophone: false,
                microphoneError: microphoneError ?? 'unknown',
                muted: true,
              }
            : current,
        );
      }

      logCallDebug('session:start-call:local-media-ready', {
        callId: nextCall.id,
        hasStream: Boolean(stream),
      });
      peerManager.configure(input.loadIceConfig);
      peerManager.setLocalStream(stream);
      setActiveCall((current) =>
        current?.id === nextCall.id
          ? { ...current, localPreviewStream: stream ?? undefined }
          : current,
      );
      startingCallIdRef.current = null;
      await flushPendingSignals(nextCall.id, input.onSignal);
      await connectSignalReadyPeers(
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
              microphoneError: classifyMicrophoneError(error),
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

  const reconcileCall = useCallback(
    (call: CallResource, input: ReconcileCallInput) => {
      const participants = mergeParticipantStatuses(input.participants, call);

      setActiveCall((current) => {
        if (!current || current.id !== call.id) return current;

        return {
          ...current,
          ...input,
          call,
          participants,
          participantVolumes: current.participantVolumes,
          screenShareVolumes: current.screenShareVolumes,
          status: reconciledCallStatus(call, current),
        };
      });

      const currentIdentityId = currentIdentityIdRef.current;
      const sendSignal = sendSignalRef.current;

      if (currentIdentityId) {
        peerManager.retainPeers(
          new Set(retainedRemotePeerIdentityIds(call, currentIdentityId)),
        );
      }

      if (!currentIdentityId || !sendSignal || call.status !== 'active') {
        return;
      }

      void connectSignalReadyPeers(
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
    },
    [peerManager],
  );

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
      currentIdentityIdRef.current ?? undefined,
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
          index === 0
            ? { ...participant, muted, speaking: false }
            : participant,
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

      return {
        ...current,
        deafened,
        participants: current.participants.map((participant) =>
          participant.identityId === current.currentIdentityId
            ? { ...participant, deafened }
            : participant,
        ),
      };
    });
  };

  const retryMicrophone = async () => {
    const current = activeCallRef.current;

    if (!current) return;

    try {
      const stream = await mediaManager.startAudio({
        noiseCancellationEnabled: current.noiseCancellationEnabled,
      });

      peerManager.setLocalStream(stream);
      setActiveCall((active) =>
        active?.id === current.id
          ? {
              ...active,
              hasMicrophone: true,
              localPreviewStream: stream,
              microphoneError: undefined,
              muted: false,
              participants: active.participants.map((participant) =>
                participant.identityId === active.currentIdentityId
                  ? { ...participant, mediaStream: stream, muted: false }
                  : participant,
              ),
              status:
                active.status === 'permission-denied' ? 'live' : active.status,
            }
          : active,
      );
    } catch (error) {
      setActiveCall((active) =>
        active?.id === current.id
          ? {
              ...active,
              hasMicrophone: false,
              microphoneError: classifyMicrophoneError(error),
              muted: true,
            }
          : active,
      );
    }
  };

  const toggleNoiseCancellation = async (enabled: boolean) => {
    const current = activeCallRef.current;

    if (!current) {
      logCallWarning(
        'session:toggle-noise-cancellation:ignored-no-active-call',
      );

      return;
    }

    if (!current.hasMicrophone) {
      logCallWarning(
        'session:toggle-noise-cancellation:ignored-no-microphone',
        {
          callId: current.id,
          status: current.status,
        },
      );
      setActiveCall((active) =>
        active?.id === current.id
          ? { ...active, noiseCancellationEnabled: enabled }
          : active,
      );

      return;
    }

    try {
      const stream = await mediaManager.setNoiseCancellationEnabled(enabled);

      peerManager.setLocalStream(stream);
      setActiveCall((active) =>
        active?.id === current.id
          ? localMediaSession(active, {
              cameraEnabled: mediaManager.hasCamera(),
              localPreviewStream: stream ?? undefined,
              noiseCancellationEnabled: enabled,
              screenShareAudioEnabled: active.screenShareAudioEnabled,
              screenShareQuality: active.screenShareQuality,
              screenSharing: mediaManager.hasScreenShare(),
              screenStream: mediaManager.screenPreviewStream(),
            })
          : active,
      );
    } catch (error) {
      logCallError('session:toggle-noise-cancellation:failed', error, {
        callId: current.id,
        enabled,
      });

      throw error;
    }
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
              noiseCancellationEnabled: active.noiseCancellationEnabled,
              screenShareAudioEnabled: active.screenShareAudioEnabled,
              screenShareQuality: active.screenShareQuality,
              screenSharing: mediaManager.hasScreenShare(),
              screenStream: mediaManager.screenPreviewStream(),
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
        ? await mediaManager.enableScreenShare({
            audioEnabled: true,
            quality: current.screenShareQuality,
          })
        : mediaManager.disableScreenShare();

      peerManager.setLocalStream(stream);
      setActiveCall((active) =>
        active?.id === current.id
          ? localMediaSession(active, {
              cameraEnabled: mediaManager.hasCamera(),
              localPreviewStream: stream ?? undefined,
              noiseCancellationEnabled: active.noiseCancellationEnabled,
              screenShareAudioEnabled: true,
              screenShareQuality: active.screenShareQuality,
              screenSharing,
              screenStream: mediaManager.screenPreviewStream(),
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

  const setParticipantScreenShareVolume = (
    identityId: string,
    volumePercent: number,
  ) => {
    const current = activeCallRef.current;

    if (current?.currentIdentityId === identityId) {
      mediaManager.setScreenShareAudioVolume(volumePercent);
    } else {
      peerManager.setPeerScreenShareVolume(identityId, volumePercent);
    }

    setActiveCall((current) => {
      if (!current) return current;

      return {
        ...current,
        screenShareVolumes: {
          ...current.screenShareVolumes,
          [identityId]: volumePercent,
        },
      };
    });
  };

  const setScreenShareQuality = async (quality: ScreenShareQualityPreset) => {
    const current = activeCallRef.current;

    if (!current) return;

    peerManager.setScreenShareQuality(quality);

    try {
      const stream = await mediaManager.setScreenShareQuality(quality);

      setActiveCall((active) =>
        active?.id === current.id
          ? localMediaSession(active, {
              cameraEnabled: mediaManager.hasCamera(),
              localPreviewStream: stream ?? undefined,
              noiseCancellationEnabled: active.noiseCancellationEnabled,
              screenShareAudioEnabled: active.screenShareAudioEnabled,
              screenShareQuality: quality,
              screenSharing: mediaManager.hasScreenShare(),
              screenStream: mediaManager.screenPreviewStream(),
            })
          : active,
      );
    } catch (error) {
      logCallError('session:screen-share-quality:failed', error, {
        callId: current.id,
        quality,
      });
      setActiveCall((active) =>
        active?.id === current.id
          ? { ...active, screenShareQuality: quality }
          : active,
      );
    }
  };

  return {
    activeCall,
    callMediaConnections,
    endCall,
    receiveSignal,
    reconcileCall,
    setScreenShareQuality,
    setParticipantScreenShareVolume,
    setParticipantVolume,
    startCall,
    toggleCamera,
    toggleDeafen,
    toggleMute,
    toggleNoiseCancellation,
    retryMicrophone,
    toggleScreenShare,
  };

  async function connectSignalReadyPeers(
    call: CallSession,
    currentIdentityId: string,
    sendSignal: SignalSender,
  ): Promise<void> {
    const peerIdentityIds = call.call
      ? signalingRemotePeerIdentityIds(call.call, currentIdentityId)
      : [];

    logCallDebug('session:connect-signal-ready-peers', {
      callId: call.id,
      currentIdentityId,
      signalingParticipantCount: peerIdentityIds.length,
      participantCount: call.participants.length,
    });
    await Promise.all(
      peerIdentityIds.map((peerIdentityId) =>
        peerManager.ensurePeer(
          peerIdentityId,
          shouldCreateInitialOffer(currentIdentityId, peerIdentityId),
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
        currentIdentityIdRef.current ?? undefined,
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
      participant,
    ]),
  );

  return participants.map((participant) => {
    const resourceParticipant = byIdentityId.get(participant.identityId);

    return {
      ...participant,
      connected: resourceParticipant?.connected ?? participant.connected,
      lastHeartbeatAt:
        resourceParticipant?.lastHeartbeatAt ?? participant.lastHeartbeatAt,
      mediaConnections:
        resourceParticipant?.mediaConnections ?? participant.mediaConnections,
      status: resourceParticipant?.status ?? participant.status,
    };
  });
}

function reconciledCallStatus(
  call: CallResource,
  current: CallSession,
): CallSession['status'] {
  if (call.status === 'active') return current.status;

  return call.status === 'missed' ? 'missed' : 'ended';
}

function localMediaFlagsChanged(
  call: CallSession,
  cameraEnabled: boolean,
  screenSharing: boolean,
): boolean {
  return (
    call.cameraEnabled !== cameraEnabled || call.screenSharing !== screenSharing
  );
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
    noiseCancellationEnabled: activeCall?.noiseCancellationEnabled ?? true,
    participants,
    participantVolumes: activeCall?.participantVolumes ?? {},
    screenShareAudioEnabled: activeCall?.screenShareAudioEnabled ?? true,
    screenShareQuality: activeCall?.screenShareQuality ?? 'auto',
    screenShareVolumes: activeCall?.screenShareVolumes ?? {},
    screenSharing: activeCall?.screenSharing ?? false,
    startedAt: activeCall?.startedAt ?? Date.now(),
    status: activeCall?.status ?? 'live',
  };
}

function participantsWithMediaState(
  call: CallSession,
  stats: Record<string, PeerMediaStats>,
  remoteStreams: Record<string, MediaStream>,
  remoteScreenStreams: Record<string, MediaStream>,
  localAudioLevel: number,
  screenStream?: MediaStream,
): CallParticipant[] {
  return call.participants.map((participant) =>
    participant.identityId === call.currentIdentityId
      ? localParticipantWithMediaState(
          participant,
          call,
          localAudioLevel,
          screenStream,
        )
      : remoteParticipantWithMediaState(
          participant,
          stats,
          remoteStreams,
          remoteScreenStreams,
        ),
  );
}

function localParticipantWithMediaState(
  participant: CallParticipant,
  call: CallSession,
  audioLevel: number,
  screenStream?: MediaStream,
): CallParticipant {
  return {
    ...participant,
    audioLevel,
    deafened: call.deafened,
    mediaStream: call.localPreviewStream,
    muted: call.muted,
    screenSharing: call.screenSharing,
    screenStream,
    speaking: !call.muted && audioLevel > 0.04,
    videoEnabled: hasVideoTrack(call.localPreviewStream),
  };
}

function remoteParticipantWithMediaState(
  participant: CallParticipant,
  stats: Record<string, PeerMediaStats>,
  remoteStreams: Record<string, MediaStream>,
  remoteScreenStreams: Record<string, MediaStream>,
): CallParticipant {
  const stat = stats[participant.identityId];
  const mediaStream = remoteStreams[participant.identityId];
  const screenStream = remoteScreenStreams[participant.identityId];

  return {
    ...participant,
    audioLevel: stat?.audioLevel,
    bitrateKbps: stat?.bitrateKbps,
    codec: stat?.codec,
    connectionPath: stat?.connectionPath,
    connectionState: stat?.connectionState ?? participant.connectionState,
    iceState: stat?.iceState,
    jitterMs: stat?.jitterMs,
    latencyMs: stat?.latencyMs,
    mediaStream,
    packetsLost: stat?.packetsLost,
    screenSharing: hasVideoTrack(screenStream),
    screenStream,
    speaking: stat?.speaking ?? false,
    transport: stat?.transport,
    videoEnabled: hasVideoTrack(mediaStream),
  };
}

function localMediaSession(
  call: CallSession,
  media: Pick<
    CallSession,
    | 'cameraEnabled'
    | 'localPreviewStream'
    | 'noiseCancellationEnabled'
    | 'screenShareAudioEnabled'
    | 'screenShareQuality'
    | 'screenSharing'
  > & { screenStream?: MediaStream },
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
            screenStream: media.screenStream,
            videoEnabled: hasVideoTrack(media.localPreviewStream),
          }
        : participant,
    ),
  };
}

function hasVideoTrack(stream?: MediaStream): boolean {
  return Boolean(
    stream
      ?.getVideoTracks()
      .some((track) => track.readyState === 'live' && !track.muted),
  );
}

function callParticipantsMediaStateEqual(
  currentParticipants: CallParticipant[],
  nextParticipants: CallParticipant[],
): boolean {
  if (currentParticipants.length !== nextParticipants.length) return false;

  return currentParticipants.every((currentParticipant, index) => {
    const nextParticipant = nextParticipants[index];

    return (
      currentParticipant.identityId === nextParticipant.identityId &&
      currentParticipant.bitrateKbps === nextParticipant.bitrateKbps &&
      currentParticipant.codec === nextParticipant.codec &&
      currentParticipant.connectionPath === nextParticipant.connectionPath &&
      currentParticipant.connectionState === nextParticipant.connectionState &&
      currentParticipant.deafened === nextParticipant.deafened &&
      currentParticipant.iceState === nextParticipant.iceState &&
      currentParticipant.jitterMs === nextParticipant.jitterMs &&
      currentParticipant.latencyMs === nextParticipant.latencyMs &&
      currentParticipant.mediaStream === nextParticipant.mediaStream &&
      currentParticipant.muted === nextParticipant.muted &&
      currentParticipant.packetsLost === nextParticipant.packetsLost &&
      currentParticipant.screenSharing === nextParticipant.screenSharing &&
      currentParticipant.screenStream === nextParticipant.screenStream &&
      currentParticipant.speaking === nextParticipant.speaking &&
      currentParticipant.transport === nextParticipant.transport &&
      currentParticipant.videoEnabled === nextParticipant.videoEnabled
    );
  });
}

function classifyMicrophoneError(error: unknown): CallMicrophoneErrorCode {
  if (!window.isSecureContext) return 'not-secure';
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';

  if (!(error instanceof Error)) return 'unknown';

  if (error.name === 'NotAllowedError') return 'denied';
  if (error.name === 'NotFoundError') return 'missing-device';
  if (error.name === 'NotReadableError') return 'in-use';
  if (error.name === 'OverconstrainedError') return 'constraint';
  if (error.name === 'SecurityError') return 'security';
  if (error instanceof TypeError) return 'unsupported';

  return 'unknown';
}
