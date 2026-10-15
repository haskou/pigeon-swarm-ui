import { Timestamp } from '@haskou/value-objects';

import type { NodeBlockListRepository } from '../../domain/repositories/NodeBlockListRepository';

import { NodeBlockList } from '../../domain/NodeBlockList';
import { UnblockNodeEntryMessage } from './messages/UnblockNodeEntryMessage';

export class NodeEntryUnblocker {
  public constructor(private readonly blockLists: NodeBlockListRepository) {}

  public async unblock(message: UnblockNodeEntryMessage): Promise<NodeBlockList> {
    const actorId = message.getActorId();
    const list = NodeBlockList.continuing(
      await this.blockLists.find(actorId),
      message.getOwnerIdentityId(),
    );

    list.unblock(message.getTarget(), Timestamp.now());

    return await this.blockLists.save(list, actorId);
  }
}
