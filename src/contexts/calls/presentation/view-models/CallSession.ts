import type { CallResource } from '../../infrastructure/http/resources/CallResource';
import type { ScreenShareQualityPreset } from '../../infrastructure/media/ScreenShareQualityPreset';
import type { CallMediaEncryptionState } from './CallMediaEncryptionState';
import type { CallMicrophoneErrorCode } from './CallMicrophoneErrorCode';
import type { CallParticipant } from './CallParticipant';

export type CallSession = {
  call?: CallResource;
  id: string;
  currentIdentityId: string;
  communityId?: string;
  channelId?: string;
  conversationId?: string;
  kind: 'community-voice' | 'group' | 'one-to-one';
  mediaEncryption: CallMediaEncryptionState;
  muted: boolean;
  microphoneError?: CallMicrophoneErrorCode;
  noiseCancellationEnabled: boolean;
  hasMicrophone: boolean;
  cameraEnabled: boolean;
  deafened: boolean;
  localPreviewStream?: MediaStream;
  participants: CallParticipant[];
  participantVolumes: Record<string, number>;
  screenShareAudioEnabled: boolean;
  screenShareQuality: ScreenShareQualityPreset;
  screenShareVolumes: Record<string, number>;
  screenSharing: boolean;
  startedAt: number;
  status:
    | 'connecting'
    | 'ended'
    | 'failed'
    | 'incoming'
    | 'live'
    | 'missed'
    | 'permission-denied';
  subtitle?: string;
  title: string;
};
