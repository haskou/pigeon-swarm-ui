import { Timestamp } from '@haskou/value-objects';

import type { NetworkNode } from '../../domain/aggregates/NetworkNode';
import type { NetworkNodeRepository } from '../../domain/repositories/NetworkNodeRepository';

import { CreatePublicNetworkMessage } from './messages/CreatePublicNetworkMessage';

export class PublicNetworkCreator {
  public constructor(private readonly nodes: NetworkNodeRepository) {}

  public async create(
    message: CreatePublicNetworkMessage,
  ): Promise<NetworkNode> {
    const node = await this.nodes.find();

    node.attachPublicNetwork(Timestamp.now());

    return await this.nodes.save(node, message.getActorId());
  }
}
