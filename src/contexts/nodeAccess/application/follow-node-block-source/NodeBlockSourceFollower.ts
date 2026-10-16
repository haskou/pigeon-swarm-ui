import { Timestamp } from '@haskou/value-objects';

import type { NodeBlockSourceRepository } from '../../domain/repositories/NodeBlockSourceRepository';

import { NodeBlockSource } from '../../domain/NodeBlockSource';
import { FollowNodeBlockSourceMessage } from './messages/FollowNodeBlockSourceMessage';

export class NodeBlockSourceFollower {
  public constructor(private readonly sources: NodeBlockSourceRepository) {}

  /** Follows a source, or reconfigures one already followed. */
  public async follow(
    message: FollowNodeBlockSourceMessage,
  ): Promise<NodeBlockSource> {
    return await this.sources.save(
      NodeBlockSource.follow(
        message.getSourceOwnerIdentityId(),
        message.getOrigin(),
        message.isAutoApplied(),
        Timestamp.now(),
      ),
      message.getActorId(),
    );
  }
}
