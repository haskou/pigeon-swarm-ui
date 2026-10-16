import type { CallIceServerResource as CallIceServerConfig } from '../../infrastructure/http/resources/CallIceServerResource';
import type { CallResource } from '../../infrastructure/http/resources/CallResource';
import type { CallMediaKey } from '../../infrastructure/media/CallMediaKey';
import type { CallMediaEncryptionUnavailableReason } from '../view-models/CallMediaEncryptionUnavailableReason';
import type { CallMicrophoneErrorCode } from '../view-models/CallMicrophoneErrorCode';
import type { CallParticipant } from '../view-models/CallParticipant';
import type { CallSession } from '../view-models/CallSession';
import type { CallSignalSender as SignalSender } from './CallSignalDispatcher';

export type StartCallInput = {
  call?: CallResource;
  currentIdentityId: string;
  id: string;
  communityId?: string;
  channelId?: string;
  conversationId?: string;
  kind: CallSession['kind'];
  loadIceConfig: () => Promise<CallIceServerConfig>;
  localStream?: MediaStream | null;
  microphoneError?: CallMicrophoneErrorCode;
  mediaEncryptionKey?: CallMediaKey;
  mediaEncryptionUnavailableReason?: CallMediaEncryptionUnavailableReason;
  noiseCancellationEnabled: boolean;
  onSignal: SignalSender;
  participants: CallParticipant[];
  subtitle?: string;
  title: string;
};
