import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { NetworkId } from '../../domain/value-objects/NetworkId';
import type { NodeNetwork } from '../list-node-networks/NodeNetwork';

export interface RemoveNodeNetworkPort {
  remove(networkId: NetworkId, session?: Session): Promise<NodeNetwork[]>;
}
