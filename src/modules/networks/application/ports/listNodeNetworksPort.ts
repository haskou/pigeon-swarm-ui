import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { NodeNetwork } from '../list-node-networks/listNodeNetworks.types';

export interface ListNodeNetworksPort {
  getNodeNetworks(session?: Session): Promise<NodeNetwork[]>;
}
