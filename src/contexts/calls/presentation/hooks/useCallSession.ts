import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CallIceServerResource as CallIceServerConfig } from '../../infrastructure/http/resources/CallIceServerResource';
import type { CallParticipantMediaConnectionResource as CallParticipantMediaConnection } from '../../infrastructure/http/resources/CallParticipantMediaConnectionResource';
import type { CallResource } from '../../infrastructure/http/resources/CallResource';
import type { ScreenShareQualityPreset } from '../../infrastructure/media/ScreenShareQualityPreset';
import type { CallMediaEncryptionUnavailableReason } from '../view-models/CallMediaEncryptionUnavailableReason';
import type { CallMicrophoneErrorCode } from '../view-models/CallMicrophoneErrorCode';
import type { CallParticipant } from '../view-models/CallParticipant';
import type { CallSession } from '../view-models/CallSession';
import type {
  CallSignalSender as SignalSender,
  ReceivedCallSignal as ReceivedSignal,
} from './CallSignalDispatcher';

import { BrowserRemoteAudioElementHost } from '../../infrastructure/media/BrowserRemoteAudioElementHost';
import {
  logCallDebug,
  logCallError,
  logCallWarning,
} from '../../infrastructure/media/callDebugLogger';
import { CallPeerConnections } from '../../infrastructure/media/CallPeerConnections';
import { LocalCallMedia } from '../../infrastructure/media/LocalCallMedia';
import { RemoteCallAudio } from '../../infrastructure/media/RemoteCallAudio';
import { retainedRemotePeerIdentityIds } from './callPeerConnectionPlan';
import {
  callMediaEncryptionState,
  callSessionForJoinedPeerConnection,
  reconciledCallStatus,
} from './callSessionMediaState';
import { CallSignalDispatcher } from './CallSignalDispatcher';
import { classifyCallMicrophoneError } from './classifyCallMicrophoneError';
import { reconciledCallParticipants } from './reconciledCallParticipants';
import { useCallMediaControls } from './useCallMediaControls';
import { useCallStatsRefresh } from './useCallStatsRefresh';

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
  mediaEncryptionEnabled: boolean;
  mediaEncryptionKey?: string;
  mediaEncryptionUnavailableReason?: CallMediaEncryptionUnavailableReason;
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
  | 'mediaEncryptionEnabled'
  | 'mediaEncryptionKey'
  | 'mediaEncryptionUnavailableReason'
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
  toggleMediaEncryption: () => void;
  toggleNoiseCancellation: (enabled: boolean) => Promise<void>;
  retryMicrophone: () => Promise<void>;
  retryConnection: () => void;
  toggleScreenShare: () => Promise<void>;
} {
  const mediaManager = useMemo(() => new LocalCallMedia(), []);
  const peerManager = useMemo(
    () =>
      new CallPeerConnections(
        new RemoteCallAudio(new BrowserRemoteAudioElementHost()),
      ),
    [],
  );
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const activeCallRef = useRef<CallSession | null>(null);
  const signals = useMemo(
    () =>
      new CallSignalDispatcher(peerManager, () => activeCallRef.current?.id),
    [peerManager],
  );
  const callMediaConnections = useCallback(
    () => peerManager.mediaConnections(),
    [peerManager],
  );
  const mediaControls = useCallMediaControls({
    activeCallRef,
    mediaManager,
    peerManager,
    setActiveCall,
  });

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useCallStatsRefresh({
    activeCallId: activeCall?.id,
    mediaManager,
    peerManager,
    setActiveCall,
  });

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
    signals.begin(input.currentIdentityId, input.onSignal, input.id);
    const mediaEncryption = callMediaEncryptionState({
      enabled: input.mediaEncryptionEnabled,
      key: input.mediaEncryptionKey,
      reason: input.mediaEncryptionUnavailableReason,
    });
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
      mediaEncryption,
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
                  microphoneError = classifyCallMicrophoneError(error);

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
      peerManager.configureMediaEncryption(
        input.mediaEncryptionKey ?? null,
        mediaEncryption.active,
      );
      peerManager.setLocalStream(stream);
      setActiveCall((current) =>
        current?.id === nextCall.id
          ? { ...current, localPreviewStream: stream ?? undefined }
          : current,
      );
      signals.markStarted();
      await signals.flushPending(nextCall.id, input.onSignal);
      await signals.connectSignalReadyPeers(
        nextCall,
        input.currentIdentityId,
        input.onSignal,
      );
      await signals.flushPending(nextCall.id, input.onSignal);
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
      signals.discardPending(nextCall.id);
      setActiveCall((current) =>
        current?.id === nextCall.id
          ? {
              ...current,
              hasMicrophone: false,
              microphoneError: classifyCallMicrophoneError(error),
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
    signals.reset();
    setActiveCall(null);
  };

  const reconcileCall = useCallback(
    (call: CallResource, input: ReconcileCallInput) => {
      const participants = reconciledCallParticipants(
        activeCallRef.current?.participants ?? [],
        input.participants,
        call,
      );

      setActiveCall((current) => {
        if (!current || current.id !== call.id) return current;

        return {
          ...current,
          ...input,
          call,
          participants: reconciledCallParticipants(
            current.participants,
            input.participants,
            call,
          ),
          participantVolumes: current.participantVolumes,
          screenShareVolumes: current.screenShareVolumes,
          status: reconciledCallStatus(call, current),
        };
      });

      const currentIdentityId = signals.currentIdentityId;
      const sendSignal = signals.sendSignal;

      if (currentIdentityId) {
        peerManager.retainPeers(
          new Set(retainedRemotePeerIdentityIds(call, currentIdentityId)),
        );
      }

      if (!currentIdentityId || !sendSignal || call.status !== 'active') {
        return;
      }

      void signals.connectSignalReadyPeers(
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
    [peerManager, signals],
  );

  const receiveSignal = (input: ReceivedSignal) => signals.receive(input);

  const retryConnection = useCallback(() => {
    if (activeCallRef.current) peerManager.retryConnections();
  }, [peerManager]);

  return {
    activeCall,
    callMediaConnections,
    endCall,
    receiveSignal,
    reconcileCall,
    retryConnection,
    startCall,
    ...mediaControls,
  };
}
