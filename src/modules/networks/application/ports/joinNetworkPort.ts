import type { NetworkId } from '../../domain/value-objects/networkId';
import type { NetworkKey } from '../../domain/value-objects/networkKey';
import type { NetworkName } from '../../domain/value-objects/networkName';

export interface JoinNetworkPort {
  joinNetwork(id: NetworkId, name: NetworkName, key: NetworkKey): Promise<void>;
}
