import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { CallIceServerConfig } from '../../domain/callSession.types';

export interface GetIceServersPort {
  getIceServers(session: Session): Promise<CallIceServerConfig>;
}
