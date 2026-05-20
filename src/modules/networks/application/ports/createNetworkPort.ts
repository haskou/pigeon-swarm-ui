import type { NetworkName } from '../../domain/value-objects/networkName';

export interface CreateNetworkPort {
  create(name: NetworkName): Promise<void>;
}
