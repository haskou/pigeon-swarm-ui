import type { NodeRelayConfiguration } from '../../domain/NodeRelayConfiguration';
import type { NodeRelayConfigurationRepository } from '../../domain/repositories/NodeRelayConfigurationRepository';

import { FindNodeRelayConfigurationMessage } from './messages/FindNodeRelayConfigurationMessage';

export class NodeRelayConfigurationFinder {
  public constructor(
    private readonly relayConfigurations: NodeRelayConfigurationRepository,
  ) {}

  public async find(
    message: FindNodeRelayConfigurationMessage,
  ): Promise<NodeRelayConfiguration> {
    return await this.relayConfigurations.find(message.getActorId());
  }
}
