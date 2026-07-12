import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { NodeRelayConfiguration } from '../configure-node-relay/NodeRelayConfiguration';

export interface UpdateRelayConfigurationPort {
  updateRelayConfiguration(
    configuration: NodeRelayConfiguration,
    session?: Session,
  ): Promise<NodeRelayConfiguration>;
}
