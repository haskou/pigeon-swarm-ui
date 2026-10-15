import { Timestamp } from '@haskou/value-objects';

import type { NodeBlockPublication } from '../../domain/NodeBlockPublication';
import type { NodeBlockPublicationRepository } from '../../domain/repositories/NodeBlockPublicationRepository';

import { ChangeNodeBlockPublicationMessage } from './messages/ChangeNodeBlockPublicationMessage';

export class NodeBlockPublicationChanger {
  public constructor(
    private readonly publications: NodeBlockPublicationRepository,
  ) {}

  public async change(
    message: ChangeNodeBlockPublicationMessage,
  ): Promise<NodeBlockPublication> {
    const actorId = message.getActorId();
    const publication = await this.publications.find(actorId);

    publication.change(message.isPublished(), Timestamp.now());

    return await this.publications.save(publication, actorId);
  }
}
