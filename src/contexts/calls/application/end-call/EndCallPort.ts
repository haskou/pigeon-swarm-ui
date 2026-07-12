import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface EndCallPort {
  end(session: Session, callId: string): Promise<void>;
}
