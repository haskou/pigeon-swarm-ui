import { Timestamp } from '@haskou/value-objects';

import type { NetworkNode } from '../../domain/aggregates/NetworkNode';
import type { NetworkNodeRepository } from '../../domain/repositories/NetworkNodeRepository';

import { ClaimNetworkNodeMessage } from './messages/ClaimNetworkNodeMessage';

export class NetworkNodeClaimer {
  public constructor(private readonly nodes: NetworkNodeRepository) {}

  public async claim(message: ClaimNetworkNodeMessage): Promise<NetworkNode> {
    const node = await this.nodes.find();

    node.claim(message.getOwnerId(), Timestamp.now());

    return await this.nodes.save(node, message.getActorId());
  }
}
