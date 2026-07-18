import { Timestamp } from '@haskou/value-objects';

import type { Network } from '../../domain/aggregates/Network';
import type { NetworkRepository } from '../../domain/repositories/NetworkRepository';

import { Network as NetworkAggregate } from '../../domain/aggregates/Network';
import { JoinNetworkMessage } from './messages/JoinNetworkMessage';

export class JoinNetwork {
  public constructor(private readonly networkRepository: NetworkRepository) {}

  public async join(message: JoinNetworkMessage): Promise<Network> {
    return await this.networkRepository.create(
      NetworkAggregate.join(
        message.getId(),
        message.getName(),
        message.getKey(),
        Timestamp.now(),
      ),
      message.getActorId(),
    );
  }
}
