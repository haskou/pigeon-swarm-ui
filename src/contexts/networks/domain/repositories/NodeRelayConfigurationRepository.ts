import type { NodeRelayConfiguration } from '../NodeRelayConfiguration';
import type { NetworkActorId } from '../value-objects/NetworkActorId';

export interface NodeRelayConfigurationRepository {
  find(actorId: NetworkActorId): Promise<NodeRelayConfiguration>;
  save(
    configuration: NodeRelayConfiguration,
    actorId: NetworkActorId,
  ): Promise<NodeRelayConfiguration>;
}
