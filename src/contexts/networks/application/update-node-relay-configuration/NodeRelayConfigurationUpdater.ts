import { Timestamp } from '@haskou/value-objects';

import type { NodeRelayConfigurationRepository } from '../../domain/repositories/NodeRelayConfigurationRepository';

import { NodeRelayConfiguration } from '../../domain/NodeRelayConfiguration';
import { UpdateNodeRelayConfigurationMessage } from './messages/UpdateNodeRelayConfigurationMessage';

export class NodeRelayConfigurationUpdater {
  public constructor(
    private readonly relayConfigurations: NodeRelayConfigurationRepository,
  ) {}

  public async update(
    message: UpdateNodeRelayConfigurationMessage,
  ): Promise<NodeRelayConfiguration> {
    const actorId = message.getActorId();
    const occurredAt = Timestamp.now();
    const configuration = actorId.isAnonymous()
      ? NodeRelayConfiguration.create(
          message.getNodeId(),
          message.getCallsRelay(),
          message.getManualRelayMultiaddresses(),
          message.getPrivateRelay(),
          message.getPublicHost(),
          message.getPublicNetwork(),
          occurredAt,
        )
      : await this.relayConfigurations.find(actorId);

    if (!actorId.isAnonymous()) {
      configuration.configure(
        message.getCallsRelay(),
        message.getManualRelayMultiaddresses(),
        message.getPrivateRelay(),
        message.getPublicHost(),
        message.getPublicNetwork(),
        occurredAt,
      );
    }

    return await this.relayConfigurations.save(configuration, actorId);
  }
}
