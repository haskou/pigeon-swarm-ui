import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { CallResource } from '../../domain/callSession.types';

export interface GetCallPort {
  get(session: Session, callId: string): Promise<CallResource>;
}
