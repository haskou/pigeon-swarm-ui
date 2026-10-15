import type { NodeBlockPublication } from '../../domain/NodeBlockPublication';
import type { NodeBlockPublicationRepository } from '../../domain/repositories/NodeBlockPublicationRepository';

import { FindNodeBlockPublicationMessage } from './messages/FindNodeBlockPublicationMessage';

export class NodeBlockPublicationFinder {
  public constructor(private readonly publications: NodeBlockPublicationRepository) {}

  public async find(message: FindNodeBlockPublicationMessage): Promise<NodeBlockPublication> {
    return await this.publications.find(message.getActorId());
  }
}
