import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { NodeRelayConfiguration } from '../configure-node-relay/NodeRelayConfiguration';

export interface GetRelayConfigurationPort {
  getRelayConfiguration(session: Session): Promise<NodeRelayConfiguration>;
}
