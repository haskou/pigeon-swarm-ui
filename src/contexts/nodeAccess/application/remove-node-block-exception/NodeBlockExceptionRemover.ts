import { Timestamp } from '@haskou/value-objects';

import type { NodeBlockExceptions } from '../../domain/NodeBlockExceptions';
import type { NodeBlockExceptionsRepository } from '../../domain/repositories/NodeBlockExceptionsRepository';

import { RemoveNodeBlockExceptionMessage } from './messages/RemoveNodeBlockExceptionMessage';

export class NodeBlockExceptionRemover {
  public constructor(
    private readonly exceptions: NodeBlockExceptionsRepository,
  ) {}

  public async remove(message: RemoveNodeBlockExceptionMessage): Promise<NodeBlockExceptions> {
    const actorId = message.getActorId();
    const exceptions = await this.exceptions.find(actorId);

    exceptions.removeException(message.getTarget(), Timestamp.now());

    return await this.exceptions.save(exceptions, actorId);
  }
}
