import type { NodeBlockSource } from '../../domain/NodeBlockSource';
import type { NodeBlockSourceRepository } from '../../domain/repositories/NodeBlockSourceRepository';

import { SearchNodeBlockSourcesMessage } from './messages/SearchNodeBlockSourcesMessage';

export class NodeBlockSourcesSearcher {
  public constructor(private readonly sources: NodeBlockSourceRepository) {}

  public async search(message: SearchNodeBlockSourcesMessage): Promise<NodeBlockSource[]> {
    return await this.sources.search(message.getActorId());
  }
}
