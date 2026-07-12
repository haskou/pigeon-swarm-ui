import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type {
  CallSignalDelivery,
  CallSignalPayload,
} from '../../domain/callSession.types';

export interface SendCallSignalPort {
  sendSignal(
    session: Session,
    callId: string,
    signal: CallSignalPayload,
  ): Promise<CallSignalDelivery>;
}
