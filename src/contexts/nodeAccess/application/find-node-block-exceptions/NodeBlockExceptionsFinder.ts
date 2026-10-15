import type { NodeBlockExceptions } from '../../domain/NodeBlockExceptions';
import type { NodeBlockExceptionsRepository } from '../../domain/repositories/NodeBlockExceptionsRepository';

import { FindNodeBlockExceptionsMessage } from './messages/FindNodeBlockExceptionsMessage';

export class NodeBlockExceptionsFinder {
  public constructor(
    private readonly exceptions: NodeBlockExceptionsRepository,
  ) {}

  public async find(
    message: FindNodeBlockExceptionsMessage,
  ): Promise<NodeBlockExceptions> {
    return await this.exceptions.find(message.getActorId());
  }
}
