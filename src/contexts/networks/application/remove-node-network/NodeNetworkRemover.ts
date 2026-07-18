import { Timestamp } from '@haskou/value-objects';

import type { Network } from '../../domain/aggregates/Network';
import type { NetworkRepository } from '../../domain/repositories/NetworkRepository';

import { RemoveNodeNetworkMessage } from './messages/RemoveNodeNetworkMessage';

export class NodeNetworkRemover {
  public constructor(private readonly networkRepository: NetworkRepository) {}

  public async remove(message: RemoveNodeNetworkMessage): Promise<Network> {
    const network = await this.networkRepository.find(
      message.getNetworkId(),
      message.getActorId(),
    );

    network.remove(Timestamp.now());

    return await this.networkRepository.save(network, message.getActorId());
  }
}
