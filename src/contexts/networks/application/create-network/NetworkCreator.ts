import { Timestamp } from '@haskou/value-objects';

import type { Network } from '../../domain/aggregates/Network';
import type { NetworkRepository } from '../../domain/repositories/NetworkRepository';

import { Network as NetworkAggregate } from '../../domain/aggregates/Network';
import { CreateNetworkMessage } from './messages/CreateNetworkMessage';

export class NetworkCreator {
  public constructor(private readonly networkRepository: NetworkRepository) {}

  public async create(message: CreateNetworkMessage): Promise<Network> {
    return await this.networkRepository.create(
      NetworkAggregate.create(message.getName(), Timestamp.now()),
      message.getActorId(),
    );
  }
}
