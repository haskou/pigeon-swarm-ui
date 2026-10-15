import { Timestamp } from '@haskou/value-objects';

import type { NodeBlockExceptions } from '../../domain/NodeBlockExceptions';
import type { NodeBlockExceptionsRepository } from '../../domain/repositories/NodeBlockExceptionsRepository';

import { ExceptNodeBlockEntryMessage } from './messages/ExceptNodeBlockEntryMessage';

export class NodeBlockEntryExcepter {
  public constructor(
    private readonly exceptions: NodeBlockExceptionsRepository,
  ) {}

  public async except(message: ExceptNodeBlockEntryMessage): Promise<NodeBlockExceptions> {
    const actorId = message.getActorId();
    const exceptions = await this.exceptions.find(actorId);

    exceptions.except(message.getTarget(), Timestamp.now());

    return await this.exceptions.save(exceptions, actorId);
  }
}
