import type { ScreenShareQualityPreset } from '../../../../contexts/calls/infrastructure/media/ScreenShareQualityPreset';
import type { CallSession } from '../../../../contexts/calls/presentation/view-models/CallSession';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';
import type { CallStartActions } from './CallStartActions';
import type { IncomingWorkspaceCall } from './useCallResourceReconciliation';

export type WorkspaceCalls = Pick<
  CallStartActions,
  | 'acceptIncomingCall'
  | 'declineIncomingCall'
  | 'startCommunityVoiceCall'
  | 'startConversationCall'
> & {
  activeCall: CallSession | null;
  handleRealtimeCallEvent: (event: RealtimeDomainEvent) => void;
  incomingCall: IncomingWorkspaceCall | null;
  leaveActiveCall: () => void;
  recoverRealtimeCalls: () => void;
  retryConnection: () => void;
  retryMicrophone: (deviceId?: string) => Promise<void>;
  setParticipantScreenShareVolume: (
    identityId: string,
    volumePercent: number,
  ) => void;
  setParticipantVolume: (identityId: string, volumePercent: number) => void;
  setScreenShareQuality: (quality: ScreenShareQualityPreset) => Promise<void>;
  toggleCallNoiseCancellation: () => void;
  toggleCamera: () => Promise<void>;
  toggleDeafen: () => void;
  toggleMute: () => void;
  toggleScreenShare: () => Promise<void>;
};
