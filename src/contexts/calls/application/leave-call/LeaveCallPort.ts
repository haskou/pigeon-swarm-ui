import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface LeaveCallPort {
  leave(session: Session, callId: string): Promise<void>;
}
