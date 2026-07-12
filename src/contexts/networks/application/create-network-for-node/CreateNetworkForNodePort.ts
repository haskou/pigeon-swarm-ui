import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface CreateNetworkForNodePort {
  createNetwork(name: string, session: Session): Promise<void>;
}
