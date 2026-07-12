import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface JoinNetworkForNodePort {
  joinNetwork(
    id: string,
    name: string,
    key: string,
    session: Session,
  ): Promise<void>;
}
