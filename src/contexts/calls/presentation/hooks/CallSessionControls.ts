import type { CallParticipantMediaConnectionResource as CallParticipantMediaConnection } from '../../infrastructure/http/resources/CallParticipantMediaConnectionResource';
import type { CallResource } from '../../infrastructure/http/resources/CallResource';
import type { ScreenShareQualityPreset } from '../../infrastructure/media/ScreenShareQualityPreset';
import type { CallSession } from '../view-models/CallSession';
import type { ReceivedCallSignal as ReceivedSignal } from './CallSignalDispatcher';
import type { ReconcileCallInput } from './ReconcileCallInput';
import type { StartCallInput } from './StartCallInput';

export type CallSessionControls = {
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
  retryMicrophone: (deviceId?: string) => Promise<void>;
  retryConnection: () => void;
  recoverAfterDisruption: () => void;
  toggleScreenShare: () => Promise<void>;
};
