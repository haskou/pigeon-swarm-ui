import { Timestamp } from '@haskou/value-objects';

import type { NodeBlockListRepository } from '../../domain/repositories/NodeBlockListRepository';

import { NodeBlockList } from '../../domain/NodeBlockList';
import { BlockNodeEntryMessage } from './messages/BlockNodeEntryMessage';

export class NodeEntryBlocker {
  public constructor(private readonly blockLists: NodeBlockListRepository) {}

  public async block(message: BlockNodeEntryMessage): Promise<NodeBlockList> {
    const actorId = message.getActorId();
    const list = NodeBlockList.continuing(
      await this.blockLists.find(actorId),
      message.getOwnerIdentityId(),
    );

    list.block(message.getTarget(), Timestamp.now());

    return await this.blockLists.save(list, actorId);
  }
}
