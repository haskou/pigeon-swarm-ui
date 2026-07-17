import type { CallResource } from '../../infrastructure/http/resources/CallResource';
import type { PeerMediaStats } from '../../infrastructure/media/CallPeerConnections';
import type { CallMediaEncryptionState } from '../view-models/CallMediaEncryptionState';
import type { CallMediaEncryptionUnavailableReason } from '../view-models/CallMediaEncryptionUnavailableReason';
import type { CallParticipant } from '../view-models/CallParticipant';
import type { CallSession } from '../view-models/CallSession';

import { CallPeerConnections } from '../../infrastructure/media/CallPeerConnections';

type ReconcileCallInput = Pick<
  CallSession,
  'channelId' | 'communityId' | 'conversationId' | 'kind' | 'subtitle' | 'title'
>;

export function reconciledCallStatus(
  call: CallResource,
  current: CallSession,
): CallSession['status'] {
  if (call.status === 'active') return current.status;

  return call.status === 'missed' ? 'missed' : 'ended';
}

export function localMediaFlagsChanged(
  call: CallSession,
  cameraEnabled: boolean,
  screenSharing: boolean,
): boolean {
  return (
    call.cameraEnabled !== cameraEnabled || call.screenSharing !== screenSharing
  );
}

export function callSessionForJoinedPeerConnection(
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
    mediaEncryption: activeCall?.mediaEncryption ?? disabledMediaEncryption(),
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

export function disabledMediaEncryption(): CallMediaEncryptionState {
  return {
    active: false,
    available: false,
    enabled: false,
    reason: 'missing-key',
  };
}

export function callMediaEncryptionState({
  enabled,
  key,
  reason,
}: {
  enabled: boolean;
  key?: string;
  reason?: CallMediaEncryptionUnavailableReason;
}): CallMediaEncryptionState {
  if (!key) {
    return {
      active: false,
      available: false,
      enabled: false,
      reason: reason ?? 'missing-key',
    };
  }

  if (!CallPeerConnections.mediaEncryptionSupported()) {
    return {
      active: false,
      available: false,
      enabled: false,
      reason: 'unsupported',
    };
  }

  return {
    active: enabled,
    available: true,
    enabled,
    reason: enabled ? undefined : 'disabled',
  };
}

function hasVideoTrack(stream?: MediaStream): boolean {
  return Boolean(
    stream
      ?.getVideoTracks()
      .some((track) => track.readyState === 'live' && !track.muted),
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
    mediaEncryptionActive: call.mediaEncryption.active,
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
  isMediaEncryptionActiveWith: (identityId: string) => boolean,
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
    mediaEncryptionActive: isMediaEncryptionActiveWith(participant.identityId),
    mediaStream,
    packetsLost: stat?.packetsLost,
    screenSharing: hasVideoTrack(screenStream),
    screenStream,
    speaking: stat?.speaking ?? false,
    transport: stat?.transport,
    videoEnabled: hasVideoTrack(mediaStream),
  };
}

export function participantsWithMediaState(
  call: CallSession,
  stats: Record<string, PeerMediaStats>,
  remoteStreams: Record<string, MediaStream>,
  remoteScreenStreams: Record<string, MediaStream>,
  localAudioLevel: number,
  isMediaEncryptionActiveWith: (identityId: string) => boolean,
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
          isMediaEncryptionActiveWith,
        ),
  );
}

export function localMediaSession(
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

export function callParticipantsMediaStateEqual(
  currentParticipants: CallParticipant[],
  nextParticipants: CallParticipant[],
): boolean {
  if (currentParticipants.length !== nextParticipants.length) return false;

  return currentParticipants.every((currentParticipant, index) => {
    const nextParticipant = nextParticipants[index];

    return (
      currentParticipant.identityId === nextParticipant?.identityId &&
      currentParticipant.bitrateKbps === nextParticipant.bitrateKbps &&
      currentParticipant.codec === nextParticipant.codec &&
      currentParticipant.connectionPath === nextParticipant.connectionPath &&
      currentParticipant.connectionState === nextParticipant.connectionState &&
      currentParticipant.deafened === nextParticipant.deafened &&
      currentParticipant.iceState === nextParticipant.iceState &&
      currentParticipant.jitterMs === nextParticipant.jitterMs &&
      currentParticipant.latencyMs === nextParticipant.latencyMs &&
      currentParticipant.mediaStream === nextParticipant.mediaStream &&
      currentParticipant.mediaEncryptionActive ===
        nextParticipant.mediaEncryptionActive &&
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
