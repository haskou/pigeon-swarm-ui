import { Timestamp } from '@haskou/value-objects';

import type { NodeRegistration } from '../../domain/NodeRegistration';
import type { NodeRegistrationRepository } from '../../domain/repositories/NodeRegistrationRepository';

import { ChangeNodeRegistrationModeMessage } from './messages/ChangeNodeRegistrationModeMessage';

export class NodeRegistrationModeChanger {
  public constructor(
    private readonly registrations: NodeRegistrationRepository,
  ) {}

  public async change(
    message: ChangeNodeRegistrationModeMessage,
  ): Promise<NodeRegistration> {
    const actorId = message.getActorId();
    const registration = await this.registrations.find(actorId);

    registration.changeMode(message.getMode(), Timestamp.now());

    return await this.registrations.save(registration, actorId);
  }
}
