import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { CallResource } from '../../domain/callSession.types';

export interface JoinCallPort {
  join(session: Session, callId: string): Promise<CallResource>;
}
