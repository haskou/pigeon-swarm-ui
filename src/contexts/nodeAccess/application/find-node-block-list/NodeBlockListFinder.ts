import type { NodeBlockListRepository } from '../../domain/repositories/NodeBlockListRepository';

import { NodeBlockList } from '../../domain/NodeBlockList';
import { FindNodeBlockListMessage } from './messages/FindNodeBlockListMessage';

export class NodeBlockListFinder {
  public constructor(private readonly blockLists: NodeBlockListRepository) {}

  public async find(message: FindNodeBlockListMessage): Promise<NodeBlockList> {
    return NodeBlockList.continuing(
      await this.blockLists.find(message.getActorId()),
      message.getOwnerIdentityId(),
    );
  }
}
