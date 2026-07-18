import type { Network } from '../../domain/aggregates/Network';
import type { NetworkRepository } from '../../domain/repositories/NetworkRepository';

import { SearchNodeNetworksMessage } from './messages/SearchNodeNetworksMessage';

export class NodeNetworksSearcher {
  public constructor(private readonly networkRepository: NetworkRepository) {}

  public async search(message: SearchNodeNetworksMessage): Promise<Network[]> {
    return await this.networkRepository.search(message.getActorId());
  }
}
