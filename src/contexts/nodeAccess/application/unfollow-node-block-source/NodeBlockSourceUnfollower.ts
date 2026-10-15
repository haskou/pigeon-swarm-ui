import type { NodeBlockSource } from '../../domain/NodeBlockSource';
import type { NodeBlockSourceRepository } from '../../domain/repositories/NodeBlockSourceRepository';

import { UnfollowNodeBlockSourceMessage } from './messages/UnfollowNodeBlockSourceMessage';

export class NodeBlockSourceUnfollower {
  public constructor(private readonly sources: NodeBlockSourceRepository) {}

  public async unfollow(message: UnfollowNodeBlockSourceMessage): Promise<NodeBlockSource[]> {
    return await this.sources.remove(
      message.getSourceOwnerIdentityId(),
      message.getActorId(),
    );
  }
}
