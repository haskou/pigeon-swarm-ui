import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { NodeRelayPortCheckResource } from '../configure-node-relay/NodeRelayPortCheckResource';
import type { NodeRelayPortCheckTarget } from '../configure-node-relay/NodeRelayPortCheckTarget';

export interface CheckRelayPortsPort {
  checkRelayPorts(
    publicHost: string,
    checks: NodeRelayPortCheckTarget[],
    session: Session,
  ): Promise<NodeRelayPortCheckResource>;
}
