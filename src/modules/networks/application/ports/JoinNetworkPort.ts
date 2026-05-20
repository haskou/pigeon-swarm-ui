import type { NetworkId } from '../../domain/value-objects/NetworkId';
import type { NetworkKey } from '../../domain/value-objects/NetworkKey';
import type { NetworkName } from '../../domain/value-objects/NetworkName';

export interface JoinNetworkPort {
  joinNetwork(id: NetworkId, name: NetworkName, key: NetworkKey): Promise<void>;
}
