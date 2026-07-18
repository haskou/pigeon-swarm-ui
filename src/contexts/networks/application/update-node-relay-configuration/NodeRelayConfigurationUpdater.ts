import { Timestamp } from '@haskou/value-objects';

import type { NodeRelayConfiguration } from '../../domain/aggregates/NodeRelayConfiguration';
import type { NodeRelayConfigurationRepository } from '../../domain/repositories/NodeRelayConfigurationRepository';

import { UpdateNodeRelayConfigurationMessage } from './messages/UpdateNodeRelayConfigurationMessage';

export class NodeRelayConfigurationUpdater {
  public constructor(
    private readonly relayConfigurations: NodeRelayConfigurationRepository,
  ) {}

  public async update(
    message: UpdateNodeRelayConfigurationMessage,
  ): Promise<NodeRelayConfiguration> {
    const actorId = message.getActorId();
    const configuration = await this.relayConfigurations.find(actorId);

    configuration.configure(
      message.getCallsRelay(),
      message.getManualRelayMultiaddresses(),
      message.getPrivateRelay(),
      message.getPublicHost(),
      message.getPublicNetwork(),
      Timestamp.now(),
    );

    return await this.relayConfigurations.save(configuration, actorId);
  }
}
