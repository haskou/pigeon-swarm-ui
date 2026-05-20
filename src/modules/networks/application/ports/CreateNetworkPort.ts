import type { NetworkName } from '../../domain/value-objects/NetworkName';

export interface CreateNetworkPort {
  create(name: NetworkName): Promise<void>;
}
