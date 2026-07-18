import type { Network } from '../../domain/aggregates/Network';
import type { NetworkRepository } from '../../domain/repositories/NetworkRepository';

import { ListNodeNetworksMessage } from './messages/ListNodeNetworksMessage';

export class ListNodeNetworks {
  public constructor(private readonly networkRepository: NetworkRepository) {}

  public async list(message: ListNodeNetworksMessage): Promise<Network[]> {
    return await this.networkRepository.search(message.getActorId());
  }
}
