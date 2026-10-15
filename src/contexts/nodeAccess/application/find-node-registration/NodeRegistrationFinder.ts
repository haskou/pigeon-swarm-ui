import type { NodeRegistration } from '../../domain/NodeRegistration';
import type { NodeRegistrationRepository } from '../../domain/repositories/NodeRegistrationRepository';

import { FindNodeRegistrationMessage } from './messages/FindNodeRegistrationMessage';

export class NodeRegistrationFinder {
  public constructor(private readonly registrations: NodeRegistrationRepository) {}

  public async find(message: FindNodeRegistrationMessage): Promise<NodeRegistration> {
    return await this.registrations.find(message.getActorId());
  }
}
